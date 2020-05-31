import DynamoDB from 'aws-sdk/clients/dynamodb';
import { Lambda, SNS } from 'aws-sdk';

import { HandlerFactory, IActivityRequestHandlerBase } from './omahdog/FlowContext';
import { ResourceReference, EnvironmentVariable, ResourceAttributeReference, LambdaApplication, ApiControllerLambda, RequestHandlerLambda, FunctionReference } from './omahdog-aws/SAMTemplate';
import { DynamoDBCrudResource, LambdaInvokeResource, SNSPublishMessageResource } from './omahdog-aws/AwsResources';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { SumNumbersLambdaProxy, StoreTotalLambdaProxy, AddTwoNumbersLambdaProxy, AddThreeNumbersLambdaProxy } from './lambdaProxies';
import { AddTwoNumbersMessageProxy, AddThreeNumbersMessageProxy, SumNumbersMessageProxy, StoreTotalMessageProxy } from './messageProxies';
import { requestRouter } from './requestRouter';
import { AddNumbersApiControllerRoutes } from './apiControllerLambda';
import { DynamoDbFunctionInstanceRepository } from './omahdog-aws/DynamoDbFunctionInstanceRepository';
import { SNSExchangeMessagePublisher } from './omahdog-aws/SNSExchangeMessagePublisher';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';

// TODO 04May20: Is there any way we can lazy load these? What is the overhead of them being created for *each* function?

const templateReferences = {
    flowExchangeTopicName: new ResourceAttributeReference('FlowExchangeTopic', 'TopicName'),
    flowExchangeTopicArn: new ResourceReference('FlowExchangeTopic'),

    addTwoNumbersFunction: new FunctionReference(AddTwoNumbersHandler),
    addThreeNumbersFunction: new FunctionReference(AddThreeNumbersHandler),
    sumNumbersFunction: new FunctionReference(SumNumbersHandler),
    storeTotalFunction: new FunctionReference(StoreTotalHandler),

    flowResultTable: new ResourceReference('FlowResultTable'),
    functionInstanceTable: new ResourceReference('FunctionInstanceTable'),
};

// TODO 30May20: These will go eventually, as we will auto-generate the environment variable names
const environmentVariables = {
    sumNumbersFunctionName: new EnvironmentVariable(templateReferences.sumNumbersFunction, 'SUM_NUMBERS_FUNCTION_NAME'),
    storeTotalFunctionName: new EnvironmentVariable(templateReferences.storeTotalFunction, 'STORE_TOTAL_FUNCTION_NAME'),
    addTwoNumbersFunctionName: new EnvironmentVariable(templateReferences.addTwoNumbersFunction, 'ADD_TWO_NUMBERS_FUNCTION_NAME'),
    addThreeNumbersFunctionName: new EnvironmentVariable(templateReferences.addThreeNumbersFunction, 'ADD_THREE_NUMBERS_FUNCTION_NAME'),
    flowResultTableName: new EnvironmentVariable(templateReferences.flowResultTable, 'FLOW_RESULT_TABLE_NAME'),
    functionInstanceTableName: new EnvironmentVariable(templateReferences.functionInstanceTable, 'FLOW_INSTANCE_TABLE_NAME'),
    flowExchangeTopicArn: new EnvironmentVariable(templateReferences.flowExchangeTopicArn, 'FLOW_EXCHANGE_TOPIC_ARN')
};

const dynamoDbClient = new DynamoDB.DocumentClient();
const lambdaClient = new Lambda();
const snsClient = new SNS();

const awsResources = {
    functionInstanceTable: new DynamoDBCrudResource(
        templateReferences.functionInstanceTable, environmentVariables.functionInstanceTableName, dynamoDbClient),    
    flowExchangeTopic: new SNSPublishMessageResource(
        templateReferences.flowExchangeTopicName, environmentVariables.flowExchangeTopicArn, snsClient),

    sumNumbersFunction: new LambdaInvokeResource(
        templateReferences.sumNumbersFunction, environmentVariables.sumNumbersFunctionName, lambdaClient),
    storeTotalFunction: new LambdaInvokeResource(
        templateReferences.storeTotalFunction, environmentVariables.storeTotalFunctionName, lambdaClient),
    addTwoNumbersFunction: new LambdaInvokeResource(
        templateReferences.addTwoNumbersFunction, environmentVariables.addTwoNumbersFunctionName, lambdaClient),
    addThreeNumbersFunction: new LambdaInvokeResource(
        templateReferences.addThreeNumbersFunction, environmentVariables.addThreeNumbersFunctionName, lambdaClient),

    flowResultTable: new DynamoDBCrudResource(
        templateReferences.flowResultTable, environmentVariables.flowResultTableName, dynamoDbClient),    
};

// TODO 31May20: How can we group such resources as below?
export const functionInstanceRepository = new DynamoDbFunctionInstanceRepository(repository => {
    repository.resources.functionInstanceTable = awsResources.functionInstanceTable;
});
export const exchangeMessagePublisher = new SNSExchangeMessagePublisher(publisher => {        
    publisher.resources.exchangeTopic = awsResources.flowExchangeTopic;
});

export const handlerFactory = new HandlerFactory()

    .addInitialiser(StoreTotalHandler, handler => {
        handler.resources.flowResultTable = awsResources.flowResultTable;
    })

    .addInitialiser(SumNumbersLambdaProxy, handler => {
        handler.resources.lambda = awsResources.sumNumbersFunction;
    })
    .addInitialiser(StoreTotalLambdaProxy, handler => {
        handler.resources.lambda = awsResources.storeTotalFunction;
    })
    .addInitialiser(AddTwoNumbersLambdaProxy, handler => {
        handler.resources.lambda = awsResources.addTwoNumbersFunction;
    })
    .addInitialiser(AddThreeNumbersLambdaProxy, handler => {
        handler.resources.lambda = awsResources.addThreeNumbersFunction;
    })
    
    .addInitialiser(AddTwoNumbersMessageProxy, handler => {
        handler.resources.requestPublisher = exchangeMessagePublisher;
    })
    .addInitialiser(AddThreeNumbersMessageProxy, handler => {
        handler.resources.requestPublisher = exchangeMessagePublisher;
    })
    .addInitialiser(StoreTotalMessageProxy, handler => {
        handler.resources.requestPublisher = exchangeMessagePublisher;
        // TODO 31May20: The following would need to cause the right MessageType filter to generate, e.g. AddThreeNumbersHandler:Response
        // handler.triggers.responseTopic = awsResources.flowExchangeTopic;
    })
    ;

const lambdas = {
    addNumbersApiController: new ApiControllerLambda(AddNumbersApiControllerRoutes, lambda => {
        lambda.restApiId = new ResourceReference('ApiGateway');
    }),
    
    // TODO 31May20: The following two need triggers for requests
    addThreeNumbersHandler: new RequestHandlerLambda(templateReferences.addThreeNumbersFunction),
    addTwoNumbersHandler: new RequestHandlerLambda(templateReferences.addTwoNumbersFunction),

    sumNumbersHandler: new RequestHandlerLambda(templateReferences.sumNumbersFunction),
    storeTotalHandler: new RequestHandlerLambda(templateReferences.storeTotalFunction),
}; 
    
export const lambdaApplication = 
    new LambdaApplication(requestRouter, handlerFactory, app => {
        
        // TODO 29May20: We should be able to set CodeUri at this point? DeadLetterQueue? functionNameTemplate?
        app.defaultFunctionNamePrefix = '${ApplicationName}-';

        app
            .addApiController(lambdas.addNumbersApiController)
            .addRequestHandler(lambdas.addThreeNumbersHandler)
            .addRequestHandler(lambdas.addTwoNumbersHandler)
            .addRequestHandler(lambdas.sumNumbersHandler)
            .addRequestHandler(lambdas.storeTotalHandler)
        ;
    });

// --------------------------------------------------------------------------------------------------------------

// TODO 29May20: Could we generate the following from the LambdaApplication instance? What about imports?
// TODO 29May20: Could we generate after a specific comment, e.g. // Generated Lambda handlers

export const addThreeNumbersHandler = async (event: any): Promise<any> => {
    return await lambdaApplication.handleRequestEvent(AddThreeNumbersHandler, event);
};

export const addNumbersApiControllerRoutes = async (event: any): Promise<any> => {
    return await lambdaApplication.handleApiEvent(AddNumbersApiControllerRoutes, event);
};

// --------------------------------------------------------------------------------------------------------------
    