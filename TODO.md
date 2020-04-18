# TODO

* Allow for 'fire-and-forget' requests
  * We will need to change the response to be either:
    * An actual response
    * A 'null' response
    * A 'suspend' response
  * E.g. `handle(): TRes | NullResponse | AsyncResponse`
  * Give NullResponse and SuspendResponse properties to identify them
  * SuspendResponse could hold the request id, e.g. `SuspendResponse.requestId` and pass it back up the chain

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
