# TODO

* Look at the following mocking frameworks:
  * [substitute.js](https://github.com/ffMathy/FluffySpoon.JavaScript.Testing.Faking)
  * [typemoq](https://github.com/florinn/typemoq)

* Generate SAM template from an 'application' class

* Look at minimising the use of `Type.name`

* Look to add a trace to the flow context and persist it in the function instance
  * Look at X-Ray
  * Look at middy and how it fits in with this approach

* Allow for 'fire-and-forget' requests
  * We will need to change the response to be either:
    * An actual response
    * A 'null' response
    * A 'suspend' response
    * An 'error' response, and a set of `onError` handlers in the definition
  * E.g. `handle(): TRes | NullResponse | AsyncResponse`
  * Give NullResponse and SuspendResponse properties to identify them
  * SuspendResponse could hold the request id, e.g. `SuspendResponse.requestId` and pass it back up the chain

* Look at interfaces for functions (https://www.typescriptlang.org/docs/handbook/interfaces.html#function-types)
```
export interface ObjectBinder<TObj, TState> {
    (obj: TObj, state: TState): void;
}

export interface StateBinder<TObj, TState> {
    (obj: TObj, state: TState): void;
}
```

* Look into 'Document This' extension
* Q. How can we ensure that handlers are in place for all requests?
  * I.e. can we do a sort of test traversal of all paths to see?

* Use object references when storing the flow stack frames, 

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

* Mocha test explorer extension

# Done

* Mocking AWS services
  * [aws-sdk-mock](https://github.com/dwyl/aws-sdk-mock)
