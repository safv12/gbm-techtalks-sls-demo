# Serverless demo for GBM Tech Talks

This demo deploy two lambdas into AWS, first one to upload pdf documents into a S3 bucket and the second one to convert that PDF file into an image.

## How to deploy

First of all you need to install the serverless framework globally in your machine.

    $ npm install -g serverless@1.33.1

Configure the IAM credentials in your machine, this credentials needs permissions.

    $ aws configure

Finally deploy the functions using.

    $ serverless deploy --env=stg
