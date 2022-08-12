const Writable = require("stream").Writable;
const _ = require("lodash");
const mime = require("mime");
const sharp = require('sharp');
const utils = require('./utils');

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
 *         @property {Boolean?} public Whether to make the file public
 *         @property {Boolean|String} keepName Whether to keep original filename or generate new UUID name
 *                                             [keepName=false, default]:
 *                                             The `upload` implements a unique filename by combining:
 *                                             • a generated UUID  (like "4d5f444-38b4-4dc3-b9c3-74cb7fbbc932")
 *                                             • the uploaded file's original extension (like ".jpg")
 *
 *                                             [keepName=true]:
 *                                             The `upload` will keep the original filename and extension.
 *
 *                                             [keepName=specified string]:
 *                                             The `upload` will rename the file as the value of `keepName`.
 *         @property {Object?} resize // refer to https://sharp.pixelplumbing.com/api-resize#resize
 *                   @property {Number?} width
 *                   @property {Number?} height
 *
 * @returns {{receive: (function(Object): *), read: ((function(*): (*))|*), ls: ls, rm: rm}}
 *         @property {Function} ls
 *         @property {Function} read
 *         @property {Function} rm
 *         @property {Function} receive
 */
module.exports = function SkipperGCS(globalOpts) {
    globalOpts = globalOpts || {};
    _.defaults(globalOpts, {
        bucket: "",
        resize: {},
        keepName: false
    });

    return {
        ls: function (dirname, done) {
            const bucket = utils.getBucket(globalOpts);
            bucket.getFiles({prefix: dirname,}, function (err, files) {
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
            const bucket = utils.getBucket(globalOpts);
            return bucket.file(fd).createReadStream();
        },
        rm: function (filename, done) {
            const bucket = utils.getBucket(globalOpts);
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
            // if maxBytes is configured in "MB" ended string
            // convert it into bytes
            if (options.maxBytes) {
                const _maxBytesRegResult = (options.maxBytes + '').match(/(\d+)m/i);
                if (!_.isNull(_maxBytesRegResult)) {
                    options.maxBytes = _maxBytesRegResult[1] * 1024 * 1024;
                }
            }

            // Build an instance of a writable stream in object mode.
            const receiver__ = Writable({objectMode: true,});
            receiver__.once('error', (unusedErr) => {
                // console.log('ERROR ON receiver ::', unusedErr);
            });//œ

            // This `_write` method is invoked each time a new file is pumped in
            // from the upstream.  `incomingFileStream` is a readable binary stream.
            receiver__._write = (incomingFileStream, encoding, proceed) => {
                utils.getOrCreateBucket(options, bucket => {
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

                    const originalName = incomingFileStream.filename || incomingFd;

                    let saveAs = utils.getFilename(originalName, incomingFd, options.keepName);

                    incomingFileStream.once('error', (unusedErr) => {
                        // console.log('ERROR ON incoming readable file stream in Skipper Google Cloud Storage adapter (%s) ::', incomingFileStream.filename, unusedErr);
                    });//œ

                    options.metadata = options.metadata || {};
                    options.metadata.contentType = mime.getType(incomingFd);
                    options.metadata.filename = originalName;

                    let file = bucket.file(saveAs);
                    file.exists(function (err, exists) {
                        if (exists) {
                            saveAs = utils.incrementalRename(saveAs);
                            file = bucket.file(saveAs);
                        }
                    });
                    const isImage = options.metadata.contentType && options.metadata.contentType.startsWith('image');
                    const resize = {...options.resize, fit: 'inside'};
                    const transformer = sharp().rotate().resize(resize);
                    const stream = isImage && (resize.width || resize.height)
                        ? incomingFileStream.pipe(transformer)
                        : incomingFileStream;

                    stream.pipe(file.createWriteStream(options))
                        .on('error', (err) => receiver__.emit("error", err))
                        .on('finish', function () {
                            incomingFileStream.extra = file.metadata;
                            // Indicate that a file was persisted.
                            receiver__.emit('writefile', incomingFileStream);
                            proceed();
                        });
                });
            };
            return receiver__;
        },
    };
};
