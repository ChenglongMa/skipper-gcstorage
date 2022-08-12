https://cloud.google.com/storage/docs/folders

# [<img title="skipper-gcstorage - Google Cloud Storage adapter for Skipper" src="http://i.imgur.com/P6gptnI.png" width="200px" alt="skipper emblem - face of a ship's captain"/>](https://github.com/ChenglongMa/skipper-gcstorage.git) Google Cloud Storage Blob Adapter

![npm](https://img.shields.io/npm/v/skipper-gcstorage)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/chenglongma/skipper-gcstorage)
![NPM](https://img.shields.io/npm/l/skipper-gcstorage)

**Google Cloud Storage** adapter for receiving [upstreams](https://github.com/balderdashy/skipper#what-are-upstreams).
Particularly useful for handling streaming multipart file uploads from
the [Skipper](https://github.com/balderdashy/skipper) body parser.

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

### Ver 2.3.0

1. Add `keepName` option which can set whether to use original filename or a generated UUID name.
2. Update dependencies to the latest version.

### Ver 2.2.0

1. Update dependencies to the latest version.
    1. [sharp](https://sharp.pixelplumbing.com/): 0.29.2, now it supports M1 chipset (
       thanks [lahiruelectrily (github.com)](https://github.com/lahiruelectrily))
    2. [mime](https://www.npmjs.com/package/mime): 3.0.0

### Ver 2.1.0

Thanks [jspark-gigworks (Anselmo Park)](https://github.com/jspark-gigworks) so much for his comments!

1. Emit `writefile` event when finishing the job.
2. Support additional `CreateWriteStreamOptions` listed
   in https://googleapis.dev/nodejs/storage/latest/global.html#CreateWriteStreamOptions.

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
        gzip: true,
        keepName: false,
        // Other options in `CreateWriteStreamOptions`
        // Refer to https://googleapis.dev/nodejs/storage/latest/global.html#CreateWriteStreamOptions
        ...CreateWriteStreamOptions,
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

### Parameters

| Name                        | Type                                      | Required                          | Default Value                                                                  | Description                                                                                                                                                                                                               |
|-----------------------------|-------------------------------------------|-----------------------------------|--------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| bucket                      | string                                    | Yes                               | None                                                                           | Bucket name in GCP, will create new one if there is no such bucket.                                                                                                                                                       |
| projectId                   | string                                    | Yes if `keyFilename` is specified | None, will try to read `process.env.GOOGLE_CLOUD_PROJECT` if not set           | "GOOGLE_CLOUD_PROJECT", please refer to [Google Cloud Storage#using-the-client-library](https://googleapis.dev/nodejs/storage/latest/index.html#using-the-client-library)                                                 |
| keyFilename                 | string                                    | No                                | None, will try to read `process.env.GOOGLE_APPLICATION_CREDENTIALS` if not set | "/path/to/GOOGLE_APPLICATION_CREDENTIALS.json"                                                                                                                                                                            |
| bucketMetadata              | dictionary                                | No                                | {}                                                                             | Metadata to set for the bucket. Refer to [Google Cloud Storage#CreateBucketRequest](https://googleapis.dev/nodejs/storage/latest/global.html#CreateBucketRequest)                                                         |
| metadata                    | dictionary                                | No                                | {}                                                                             | Extra info attached to the file                                                                                                                                                                                           |
| public                      | boolean                                   | No                                | true                                                                           | Whether to make the file public                                                                                                                                                                                           |
| keepName                    | boolean or string                         | No                                | false                                                                          | Whether to use original filename. The uploaded file will be set to: <br/>* a **UUID name** if `keepName=false`; <br/>* its **original name** if `keepName=true`; <br/>* the value of `keepName` if `keepName` is a string |
| ...CreateWriteStreamOptions | expanded dictionary                       | No                                | {}                                                                             | Options for `File#createWriteStream()`. Refer to [Google Cloud Storage#CreateWriteStreamOptions](https://googleapis.dev/nodejs/storage/latest/global.html#CreateWriteStreamOptions)                                       |
| resize                      | dictionary with keys `width` and `height` | No                                | {}                                                                             | The new size of image. Only works when the file is an image. Refer to [sharp#resize](https://sharp.pixelplumbing.com/api-resize#resize).                                                                                  |



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
3. [jspark-gigworks (Anselmo Park)](https://github.com/jspark-gigworks)

## Contribution

Pull requests are welcome!
