# [<img title="skipper-gcstorage - Google Cloud Storage adapter for Skipper" src="http://i.imgur.com/P6gptnI.png" width="200px" alt="skipper emblem - face of a ship's captain"/>](https://github.com/ChenglongMa/skipper-gcstorage.git) Google Cloud Storage Blob Adapter

[![npm version](https://badge.fury.io/js/skipper-gcstorage.svg)](https://badge.fury.io/js/skipper-gcstorage)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


**Google Cloud Storage** adapter for receiving [upstreams](https://github.com/balderdashy/skipper#what-are-upstreams). Particularly useful for handling streaming multipart file uploads from the [Skipper](https://github.com/balderdashy/skipper) body parser.

## Installation
### Option 1: NPM Package

[![NPM](https://nodei.co/npm/skipper-gcstorage.png)](https://npmjs.org/package/skipper-gcstorage)

```bash
$ npm i skipper-gcstorage
```
### Option2: GitHub Package

[![GitHub](https://nodei.co/npm/@chenglongma/skipper-gcstorage.png)](https://github.com/ChenglongMa/skipper-gcstorage/packages)

```bash
$ npm i @chenglongma/skipper-gcstorage
```

## Changelog
### Ver 2.0.0
1. Add `resize` options, which can compress the **images** before uploading.

## Usage

```javascript
req.file('avatar')
.upload({
  // Required
  adapter: require('skipper-gcstorage'),
  bucket: 'existing_or_new_bucket_name', // Will create new one if no such bucket exists.
  // Optional
  projectId: 'GOOGLE_CLOUD_PROJECT', // Mandatory if `keyFilename` was specified.
  keyFilename: '/path/to/GOOGLE_APPLICATION_CREDENTIALS.json', 
  bucketMetadata: {
    location: 'us-west1',
  },  // Refer to https://googleapis.dev/nodejs/storage/latest/global.html#CreateBucketRequest
  maxBytes: 60000, 
  metadata: {},
  public: true,
  resize: {
    width: 500,
    height: 500
  }, // Refer to https://sharp.pixelplumbing.com/api-resize#resize
}, function whenDone(err, uploadedFiles) {
  if (err) {
    return res.serverError(err);
  }
  return res.ok({
    files: uploadedFiles,
    textParams: req.params.all()
  });
});
```
Please don't check in your GCP credentials :)

### NOTE

1. `Skipper-GCStorage` will create new bucket if specified one does not exist.
   1. Assign bucket metadata into `bucketMetadata`.
2. Support multiple ways for **Authentication**
   1. Specify `projectId` AND `keyFilename`;
   2. `export` `GOOGLE_APPLICATION_CREDENTIALS` environment variable;
   3. Login with an eligible [service account](https://cloud.google.com/iam/docs/service-accounts);
   4. \*For more details, please refer to https://cloud.google.com/docs/authentication/production#command-line.
3. Use with [sails-hook-uploads](https://www.npmjs.com/package/sails-hook-uploads) for better results :)


## Acknowledgement

1. [Sails Skipper](https://github.com/sailshq/skipper)
2. [Skipper-S3](https://github.com/balderdashy/skipper-s3)