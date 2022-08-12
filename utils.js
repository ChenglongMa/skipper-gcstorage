const _ = require("lodash");
const {Storage} = require("@google-cloud/storage");

module.exports = {
    REGEX_EXTENSION: /(?:\.([^.]+))?$/,
    REGEX_SUFFIX: /(\d+)?(?!.*\d)/,

    /**
     * Get filename based on settings
     * @param {string} originalName original filename of incoming file stream
     * @param {string} uuidName a generated UUID followed by the original extension
     * @param {boolean|string} keepName whether to use original filename, defaults to false
     *                                  [keepName=false, default]:
     *                                  The `upload` implements a unique filename by combining:
     *                                  • a generated UUID  (like "4d5f444-38b4-4dc3-b9c3-74cb7fbbc932")
     *                                  • the uploaded file's original extension (like ".jpg")
     *
     *                                  [keepName=true]:
     *                                  The `upload` will keep the original filename and extension.
     *
     *                                  [keepName=specified string]:
     *                                  The `upload` will rename the file as the value of `keepName`.
     * @returns {string} expected filename
     */
    getFilename(originalName, uuidName, keepName = false) {
        let saveAs = uuidName;
        if (_.isBoolean(keepName) && keepName) {
            saveAs = originalName;
        } else if (_.isString(keepName)) {
            saveAs = keepName
        }

        let extName = this.REGEX_EXTENSION.exec(saveAs)[0];
        if (!extName) {
            extName = this.REGEX_EXTENSION.exec(uuidName)[0];
            saveAs += extName;
        }
        return saveAs;
    },

    /**
     * Rename the file with incremental suffix
     * @param filename
     * @returns {string} new filename
     */
    incrementalRename: function (filename) {
        const suffixRe = this.REGEX_SUFFIX;
        const currSuffix = suffixRe.exec(filename)[0];
        if (currSuffix) {
            return filename.replace(suffixRe, Number(currSuffix) + 1);
        } else {
            return filename.replace(this.REGEX_EXTENSION, '_1$&');
        }
    },


    /**
     * Get a bucket from gcs.
     * @param {object} options Options to access buckets
     */
    getBucket: function (options) {
        const authOpts = {
            projectId: options.projectId || process.env.GOOGLE_CLOUD_PROJECT,
            keyFilename: options.keyFilename || (this.projectId ? process.env.GOOGLE_APPLICATION_CREDENTIALS : undefined),
        }
        const storage = new Storage(this.stripKeysWithNilValues(authOpts));
        return storage.bucket(options.bucket);
    },

    /**
     * Get a bucket from gcs. Create a new one if not exists.
     * @param {object} options Options to access the bucket.
     * @param {function} cb Callback function executed after creation
     */
    getOrCreateBucket: function (options, cb) {
        const bucket = this.getBucket(options);
        bucket.exists().then(exists => {
            if (!exists[0]) {
                const metadata = this.stripKeysWithNilValues(options.bucketMetadata);
                bucket.create(metadata).then(data => {
                    const newBucket = data[0];
                    cb(newBucket);
                })
            } else {
                cb(bucket);
            }
        });
    },

    /**
     * destructive -- mutates, returns reference only for convenience
     */
    stripKeysWithNilValues: function (dictionary) {
        return _.omitBy(dictionary, _.isNil);
    },

}
