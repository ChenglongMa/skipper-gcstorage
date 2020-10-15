const Writable = require("stream").Writable;
const _ = require("lodash");
const { Storage } = require('@google-cloud/storage');
const concat = require("concat-stream");
const mime = require("mime");
const { v4: uuidv4 } = require('uuid');
const path = require('path');



/**
 * skipper-gcs
 *
 * @param  {Dictionary} globalOpts
 *         @property {String?} projectId
 *         @property {String?} keyFilename
 *         @property {String?} bucket
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
  });
  const authOpts = {
    projectId: globalOpts.projectId || process.env.GOOGLE_CLOUD_PROJECT,
    keyFilename: globalOpts.keyFilename || this.projectId ? process.env.GOOGLE_APPLICATION_CREDENTIALS : undefined,
  }
  const storage = new Storage(_stripKeysWithUndefinedValues(authOpts));

  const bucket = storage.bucket(globalOpts.bucket);
  const adapter = {
    ls: async function (dirname, cb) {
      bucket.getFiles({ prefix: dirname, }, function (err, files) {
        if (err) {
          cb(err);
        } else {
          files = _.map(files, "name");
          cb(null, files);
        }
      });
    },
    read: function (fd, cb) {
      const readStream = bucket.file(fd).createReadStream();

      readStream
        .on("error", function (err) {
          cb(err);
        })
        .on("response", function () {
          // Server connected and responded with the specified status and headers.
        })
        .on("end", function () {
          // The file is fully downloaded.
        })
        .pipe(concat(function (data) {
          cb(null, data);
        }));
    },
    rm: function (filename, cb) {
      bucket.file(filename).delete(cb);
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
      receiver__._write = function onFile(incomingFileStream, encoding, proceed) {
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
          // console.log('ERROR ON incoming readable file stream in Skipper S3 adapter (%s) ::', incomingFileStream.filename, unusedErr);
        });//œ

        const metadata = {};
        _.defaults(metadata, options.metadata);
        metadata.contentType = mime.getType(incomingFd);

        // The default `upload` implements a unique filename by combining:
        //  • a generated UUID  (like "4d5f444-38b4-4dc3-b9c3-74cb7fbbc932")
        //  • the uploaded file's original extension (like ".jpg")
        const newFilename = path.join(path.dirname(incomingFd), uuidv4() + path.extname(incomingFd));

        incomingFileStream.pipe(bucket.file(newFilename).createWriteStream({
          metadata: metadata,
        }))
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
      };
      return receiver__;
    },
  };

  return adapter;
};

//////////////////////////////////////////////////////////////////////////////

/**
 * destructive -- mutates, returns reference only for convenience
 */
function _stripKeysWithUndefinedValues(dictionary) {
  for (let k in dictionary) {
    if (dictionary[k] === undefined) {
      delete dictionary[k];
    }
  }
  return dictionary;
}//ƒ
