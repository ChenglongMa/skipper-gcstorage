const Writable = require("stream").Writable;
const _ = require("lodash");
const { Storage } = require('@google-cloud/storage');
const mime = require("mime");
const sharp = require('sharp');

/**
 * skipper-gcs
 *
 * @param  {Dictionary} globalOpts
 *         @property {String?} projectId
 *         @property {String?} keyFilename
 *         @property {String} bucket
 *         @property {Object?} bucketMetadata used to create non-existing bucket
 *         @property {Number?} maxBytes
 *         @property {Object?} metadata The metadata of gcs file
 *         @property {Bool?} public Whether to make the file public
 *         @property {Object?} resize // refer to https://sharp.pixelplumbing.com/api-resize#resize
 *                   @property {Number?} width
 *                   @property {Number?} height
 *
 * @returns {Dictionary}
 *         @property {Function} ls
 *         @property {Function} read
 *         @property {Function} rm
 *         @property {Function} receive
 */
module.exports = function SkipperGCS(globalOpts) {
  globalOpts = globalOpts || {};
  _.defaults(globalOpts, {
    bucket: "",
    resize: {}
  });

  const adapter = {
    ls: function (dirname, done) {
      const bucket = _getBucket(globalOpts);
      bucket.getFiles({ prefix: dirname, }, function (err, files) {
        if (err) {
          done(err);
        } else {
          files = _.map(files, "name");
          done(undefined, files);
        }
      });
    },
    read: function (fd) {
      if (arguments[1]) {
        return arguments[1](new Error('For performance reasons, skipper-gcstorage does not support passing in a callback to `.read()`'));
      }
      const bucket = _getBucket(globalOpts);
      return readStream = bucket.file(fd).createReadStream();
    },
    rm: function (filename, done) {
      const bucket = _getBucket(globalOpts);
      bucket.file(filename).delete(done);
    },
    /**
     * A simple receiver for Skipper that writes Upstreams to Google Cloud Storage
     *
     * @param  {Object} options
     * @return {Stream.Writable}
     */
    receive: function GCSReceiver(options) {
      options = options || {};
      _.defaults(options, globalOpts);
      // if maxBytes is configed in "MB" ended string
      // convert it into bytes
      if (options.maxBytes) {
        const _maxBytesRegResult = (options.maxBytes + '').match(/(\d+)m/i);
        if (!_.isNull(_maxBytesRegResult)) {
          options.maxBytes = _maxBytesRegResult[1] * 1024 * 1024;
        }
      };

      // Build an instance of a writable stream in object mode.
      const receiver__ = Writable({ objectMode: true, });
      receiver__.once('error', (unusedErr) => {
        // console.log('ERROR ON receiver ::', unusedErr);
      });//œ

      // This `_write` method is invoked each time a new file is pumped in
      // from the upstream.  `incomingFileStream` is a readable binary stream.
      receiver__._write = (incomingFileStream, encoding, proceed) => {
        _getOrCreatBucket(options, bucket => {
          // `skipperFd` is the file descriptor-- the unique identifier.
          // Often represents the location where file should be written.
          //
          // But note that we formerly used `fd`, but now Node attaches an `fd` property
          // to Readable streams that come from the filesystem.  So this kinda messed
          // us up.  And we had to do this instead:
          const incomingFd = incomingFileStream.skipperFd || (_.isString(incomingFileStream.fd) ? incomingFileStream.fd : undefined);
          if (!_.isString(incomingFd)) {
            return proceed(new Error('In skipper-gcstorage adapter, write() method called with a stream that has an invalid `skipperFd`: ' + incomingFd));
          }

          incomingFileStream.once('error', (unusedErr) => {
            // console.log('ERROR ON incoming readable file stream in Skipper Google Cloud Storage adapter (%s) ::', incomingFileStream.filename, unusedErr);
          });//œ

          const metadata = {};
          _.defaults(metadata, options.metadata);
          metadata.contentType = mime.getType(incomingFd);

          // The default `upload` implements a unique filename by combining:
          //  • a generated UUID  (like "4d5f444-38b4-4dc3-b9c3-74cb7fbbc932")
          //  • the uploaded file's original extension (like ".jpg")
          const file = bucket.file(incomingFd);
          const isImage = metadata.contentType && metadata.contentType.startsWith('image');
          const resize = { ...options.resize, fit: 'inside' };
          const transformer = sharp().rotate().resize(resize);
          const stream = isImage && (resize.width || resize.height)
            ? incomingFileStream.pipe(transformer)
            : incomingFileStream;

          stream.pipe(file.createWriteStream({ metadata: metadata, }))
            .on('error', (err) => receiver__.emit("error", err))
            .on('finish', function () {
              incomingFileStream.extra = file.metadata;
              if (options.public) {
                file.makePublic().then(() => {
                  incomingFileStream.extra.Location = "https://storage.googleapis.com/" + options.bucket + "/" + incomingFd;
                  proceed();
                });
              } else {
                proceed();
              }
            });
        });
      };
      return receiver__;
    },
  };

  return adapter;
};

//////////////////////////////////////////////////////////////////////////////

/**
 * Get a bucket from gcs.
 * @param {object} options Options to access buckets
 */
function _getBucket(options) {
  const authOpts = {
    projectId: options.projectId || process.env.GOOGLE_CLOUD_PROJECT,
    keyFilename: options.keyFilename || (this.projectId ? process.env.GOOGLE_APPLICATION_CREDENTIALS : undefined),
  }
  const storage = new Storage(_stripKeysWithNilValues(authOpts));
  return storage.bucket(options.bucket);
}//ƒ

/**
 * Get a bucket from gcs. Creat a new one if not exists.
 * @param {object} options Options to access the bucket.
 * @param {function} cb Callback function executed after creation
 */
function _getOrCreatBucket(options, cb) {
  const bucket = _getBucket(options);
  bucket.exists().then(exists => {
    if (!exists[0]) {
      const metadata = _stripKeysWithNilValues(options.bucketMetadata);
      bucket.create(metadata).then(data => {
        const newBucket = data[0];
        cb(newBucket);
      })
    } else {
      cb(bucket);
    }
  });
}//ƒ

/**
 * destructive -- mutates, returns reference only for convenience
 */
function _stripKeysWithNilValues(dictionary) {
  return _.omitBy(dictionary, _.isNil);
}//ƒ
