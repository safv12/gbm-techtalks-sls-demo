var async = require("async");
var AWS = require("aws-sdk");
var gm = require("gm").subClass({imageMagick: true});
var fs = require("fs");
var mktemp = require("mktemp");

var RESULT_DIR = "outputs/";
var IMAGE_WIDTH = 950;
var IMAGE_HEIGHT = 950;
var ALLOWED_FILETYPES = ['pdf'];

var utils = {
  decodeKey: function(key) {
    return decodeURIComponent(key).replace(/\+/g, ' ');
  }
};

var s3 = new AWS.S3();

exports.convert = function(event, context) {
  console.log("Starting lambda execution...");

  var bucket = event.Records[0].s3.bucket.name,
  srcKey = utils.decodeKey(event.Records[0].s3.object.key),
  dstKey = RESULT_DIR + srcKey.replace(/\.\w+$/, ".png"),
  fileType = srcKey.match(/\.\w+$/);

  if(srcKey.indexOf(RESULT_DIR) === 0) {
    return;
  }

  if (fileType === null) {
    console.error("Invalid filetype found for key: " + srcKey);
    return;
  }

  fileType = fileType[0].substr(1);

  if (ALLOWED_FILETYPES.indexOf(fileType) === -1) {
    console.error("Filetype " + fileType + " not valid for convert, exiting");
    return;
  }

  async.waterfall([

    function download(next) {
        console.log("Downloading document from S3...");
        //Download the image from S3
        s3.getObject({
          Bucket: bucket,
          Key: srcKey
        }, next);
      },

      function convertToPdf(response, next) {
        console.log("Converting document to image...");
        var temp_file, image;

        if(fileType === "pdf") {
          temp_file = mktemp.createFileSync("/tmp/XXXXXXXXXX.pdf")
          fs.writeFileSync(temp_file, response.Body);
          image = gm(temp_file + "[0]");
        }

        image.size(function(err, size) {
          var scalingFactor = Math.min(1, IMAGE_WIDTH / size.width, IMAGE_HEIGHT / size.height),
          width = scalingFactor * size.width,
          height = scalingFactor * size.height;

          this.resize(width, height)
          .toBuffer("png", function(err, buffer) {
            if(temp_file) {
              fs.unlinkSync(temp_file);
            }

            if (err) {
              next(err);
            } else {
              next(null, response.contentType, buffer);
            }
          });
        });
      },

      function uploadThumbnail(contentType, data, next) {
        console.log("Uploading new image...")
        s3.putObject({
          Bucket: bucket,
          Key: dstKey,
          Body: data,
          ContentType: "image/png",
          ACL: 'public-read'
        }, next);
      }

      ],
      function(err) {
        if (err) {
          console.error(
            "Unable to generate image for '" + bucket + "/" + srcKey + "'" +
            " due to error: " + err
            );
        } else {
          console.log("Created image for '" + bucket + "/" + srcKey + "'");
        }

        context.done();
      });
};

exports.upload = function(event, context, callback) {
    var request = JSON.parse(event.body);
    let encodedFile = request.document;
    let decodedFile = Buffer.from(encodedFile, 'base64');

    var filePath = request.filename;
    var bucket = process.env.BUCKET_NAME

    var s3Request = {
        "Body": decodedFile,
        "Bucket": bucket,
        "Key": filePath
    };

    s3.upload(s3Request, function(err, data) {
        let response = {
            "statusCode": 200,
            "body": JSON.stringify(data),
            "isBase64Encoded": false
        };

        callback(null, response);
    });
}
