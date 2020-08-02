# TODO

* Would it make sense to incorporate http://inversify.io/?
  * Do we need to support  multiple implementations of the same interface, e.g. IExchangeMessagePublisher?
  * The IoC container can handle named bindings
  * What about the overhead?
  * What about where we need references or constants?

* Q. How can we ensure that handlers are in place for all requests?
  * I.e. can we do a sort of test traversal of all paths to see?

* Generate SAM template from an 'application' class
  * Merge 'parameters' and 'services' to 'dependencies'?
  * Create a command line tool for template generation

* Look to add a trace to the flow context and persist it in the function instance
  * Look at X-Ray
  * Look at middy and how it fits in with this approach

* Logging
  * Look at how to do correlated logging through the flow context
  * We could also do sampled logging too. See 'header' information below.
  * Do we need to allow for an ILogger implementation to be passed in to FlowContext
    * Perhaps this have a 'entry type', e.g.:
      * Custom Event (this might have the log level as well)
      * Flow Request
      * Flow Response
      * Activity Request
      * Activity Response
      * Flow Branch
      * Error
  * How could the ILogger be passed from one flow to the next?
  * How can we do 'best practice' structured logging
    * (https://adrianhall.github.io/cloud/2019/06/30/building-an-efficient-logger-in-typescript/)
    * (https://github.com/structured-log/structured-log)
    * (https://www.npmjs.com/package/typescript-logging)
    * (https://www.garysieling.com/blog/log4j-alternative-typescript/)
  * What standard information would we want in the log entries?
    * Correlation Id
    * ?
  * 

* Correlation ids
  * Look at extending the flow context to have 'header' information
  * This could include a debug level

* Look at layers and stacks

* Look at SQS
  * Can we have 'enable SQS' for handlers?
  * How can we get a callback from something that doesn't know about us? We can't use the same SQS queue?

* Look to have - in the same vein as API Controller Lambda
  * SQS Lambda (would we expect a FlowExchangeMessage? - See 'Look at SQS')
  * S3 Lambda
  * DynamoDb

* [middy](https://middy.js.org/)
  * [DAZN Lambda Powertools](https://github.com/getndazn/dazn-lambda-powertools)

* Mocha test explorer extension

* [AWS-Serverless-Applications-Lens.pdf](https://d1.awsstatic.com/whitepapers/architecture/AWS-Serverless-Applications-Lens.pdf)
  * [10 Things Serverless Architects Should Know](https://aws.amazon.com/blogs/architecture/ten-things-serverless-architects-should-know/)

* Look into use of DynamoDb vs. S3 for storing flow instances
  * [S3 or DynamoDB?](https://serverless.pub/s3-or-dynamodb/)

* Look at
  * DynamoDB Accelerator (DAX) adds a highly available in-memory cache for DynamoDB that delivers up to 10x performance improvement from milliseconds to microseconds.
  * Amazon Elasticsearch Service (Amazon ES) makes it easy to deploy, secure, operate, and scale Elasticsearch for log analytics, full-text search, application monitoring, and more.
  * AWS AppSync is a managed GraphQL service with real-time and offline capabilities, as well as enterprise grade security controls that make developing applications simple. 
  * AWS X-Ray lets you analyse and debug serverless applications by providing distributed tracing and service maps to easily identify performance bottlenecks by visualizing a request end-to-end. 

* Look at minimising the use of `Type.name`
  * I.e. store as a string at the earliest opportunity to avoid unnecessary evaluation

* Use object references when storing the flow stack frames

* Allow for 'fire-and-forget' requests
  * We will need to change the response to be either:
    * A 'null' response
  * This response indicates that processing can continue and no binding to the state is required

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

* Have a DLQ for asynchronous invocation
  * [AWS Serverless Application Model - DeadLetterQueue](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-property-function-deadletterqueue.html)
  * __Q. What should happen to failed responses?__ Should it mean that the flow should be terminated?
    * __Q. Do we need to think if we should store a 'state' as part of the flow instance?__

# Done

* Mocking AWS services
  * [aws-sdk-mock](https://github.com/dwyl/aws-sdk-mock)

* Look at the following mocking frameworks:
  * [substitute.js](https://github.com/ffMathy/FluffySpoon.JavaScript.Testing.Faking)
  * [typemoq](https://github.com/florinn/typemoq)

* Look at reducing package size

* Think about how you could have one set of activities calling another
  * E.g. A decision flow calling an Affordability activity maintained by a different group
  * Calling function would have to have a reference to the topic name and ARN to send requests and receive responses
  * __Q. How persistent is an ARN?__
    * A. Very, if resource is given a name, e.g. `arn:${AWS::Partition}:sns:${AWS::Region}:${AWS::AccountId}:${topicName}`

* Provide support for calling other Lambdas directly

* Implement 'add number' flows using Step Functions
  * [ResultPath](https://docs.aws.amazon.com/step-functions/latest/dg/input-output-resultpath.html)
  * [Input and Output Processing in Step Functions](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-input-output-filtering.html)
  * [Creating a Lambda State Machine for Step Functions Using AWS CloudFormation](https://docs.aws.amazon.com/step-functions/latest/dg/tutorial-lambda-state-machine-cloudformation.html)
  * [Building Serverless workflows with AWS Step Functions](https://medium.com/finimize-engineering/building-serverless-workflows-with-aws-step-functions-89eca69a93f3)
  * [AWS::StepFunctions::StateMachine](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-stepfunctions-statemachine.html)
  * [How AWS Step Functions Works with IAM](https://docs.aws.amazon.com/step-functions/latest/dg/procedure-create-iam-role.html)
  * [IAM Policies for Integrated Services](https://docs.aws.amazon.com/step-functions/latest/dg/service-integration-iam-templates.html)

* Look at wrapping all AWS services in our own services

* [Set up Lambda proxy integrations in API Gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html)
