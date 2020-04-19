# TODO

* Allow for 'fire-and-forget' requests
  * We will need to change the response to be either:
    * An actual response
    * A 'null' response
    * A 'suspend' response
  * E.g. `handle(): TRes | NullResponse | AsyncResponse`
  * Give NullResponse and SuspendResponse properties to identify them
  * SuspendResponse could hold the request id, e.g. `SuspendResponse.requestId` and pass it back up the chain

* Q. How can we ensure that handlers are in place for all requests?
  * I.e. can we do a sort of test traversal of all paths to see?

* Generate SAM template from an 'application' class
* Use object references when storing the flow instance
* Look into use of DynamoDb vs. S3 for storing flow instances
  * [S3 or DynamoDB?](https://serverless.pub/s3-or-dynamodb/)
* [middy](https://middy.js.org/)
  * How can we use middy to parse the different events to allow for Lambdas to be called:
    * Directly
    * From API gateway
    * Via SNS message
* Logging
* Correlation ids
* AWS X-Ray
* Dependency injection
* Mocking AWS services
* Mocha test explorer extension
