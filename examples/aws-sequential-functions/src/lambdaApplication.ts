import DynamoDB from 'aws-sdk/clients/dynamodb';
import { Lambda, SNS } from 'aws-sdk';

import { HandlerFactory, IActivityRequestHandlerBase } from './omahdog/FlowContext';
import { ResourceReference, EnvironmentVariable, ResourceAttributeReference, LambdaApplication, ApiControllerLambda, RequestHandlerLambda, FunctionReference } from './omahdog-aws/SAMTemplate';
import { DynamoDBCrudResource, LambdaInvokeResource, SNSPublishMessageResource } from './omahdog-aws/AwsResources';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { SumNumbersLambdaProxy, StoreTotalLambdaProxy, AddTwoNumbersLambdaProxy, AddThreeNumbersLambdaProxy } from './lambdaProxies';
import { AddTwoNumbersMessageProxy, AddThreeNumbersMessageProxy } from './messageProxies';
import { requestRouter } from './requestRouter';
import { AddNumbersApiControllerRoutes } from './apiControllerLambda';
import { DynamoDbFunctionInstanceRepository } from './omahdog-aws/DynamoDbFunctionInstanceRepository';
import { SNSExchangeMessagePublisher } from './omahdog-aws/SNSExchangeMessagePublisher';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';

// TODO 04May20: Is there any way we can lazy load these? What is the overhead of them being created for *each* function?

const lambdas = {
    addNumbersApiController: 
        new ApiControllerLambda(AddNumbersApiControllerRoutes, lambda => {
            lambda.restApiId = new ResourceReference('ApiGateway');
        }),
    addThreeNumbersHandler: new RequestHandlerLambda(AddThreeNumbersHandler),
    addTwoNumbersHandler: new RequestHandlerLambda(AddTwoNumbersHandler),
    sumNumbersHandler: new RequestHandlerLambda(SumNumbersHandler),
    storeTotalHandler: new RequestHandlerLambda(StoreTotalHandler),
}; 

const templateReferences = {
    flowExchangeTopicName: new ResourceAttributeReference('FlowExchangeTopic', 'TopicName'),
    flowExchangeTopicArn: new ResourceReference('FlowExchangeTopic'),

    // TODO 30May20: These might go, if they are only used once
    addTwoNumbersFunction: new FunctionReference(lambdas.addTwoNumbersHandler),
    addThreeNumbersFunction: new FunctionReference(lambdas.addThreeNumbersHandler),
    sumNumbersFunction: new FunctionReference(lambdas.sumNumbersHandler),
    storeTotalFunction: new FunctionReference(lambdas.storeTotalHandler),
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

const resources = {
    sumNumbersFunction: new LambdaInvokeResource(
        templateReferences.sumNumbersFunction, environmentVariables.sumNumbersFunctionName, lambdaClient),
    storeTotalFunction: new LambdaInvokeResource(
        templateReferences.storeTotalFunction, environmentVariables.storeTotalFunctionName, lambdaClient),
    addTwoNumbersFunction: new LambdaInvokeResource(
        templateReferences.addTwoNumbersFunction, environmentVariables.addTwoNumbersFunctionName, lambdaClient),
    addThreeNumbersFunction: new LambdaInvokeResource(
        templateReferences.addThreeNumbersFunction, environmentVariables.addThreeNumbersFunctionName, lambdaClient),

    functionInstanceTable: new DynamoDBCrudResource(
        templateReferences.functionInstanceTable, environmentVariables.functionInstanceTableName, dynamoDbClient),    
    flowExchangeTopic: new SNSPublishMessageResource(
        templateReferences.flowExchangeTopicName, environmentVariables.flowExchangeTopicArn, snsClient),

    flowResultTable: new DynamoDBCrudResource(
        templateReferences.flowResultTable, environmentVariables.flowResultTableName, dynamoDbClient),    
};

export const handlerFactory = new HandlerFactory()

    .addInitialiser(StoreTotalHandler, handler => {
        handler.resources.flowResultTable = resources.flowResultTable;
    })

    .addInitialiser(SumNumbersLambdaProxy, handler => {
        handler.resources.lambda = resources.sumNumbersFunction;
    })
    .addInitialiser(StoreTotalLambdaProxy, handler => {
        handler.resources.lambda = resources.storeTotalFunction;
    })
    .addInitialiser(AddTwoNumbersLambdaProxy, handler => {
        handler.resources.lambda = resources.addTwoNumbersFunction;
    })
    .addInitialiser(AddThreeNumbersLambdaProxy, handler => {
        handler.resources.lambda = resources.addThreeNumbersFunction;
    })
    
    // TODO 30May20: In this case, we wouldn't actually have a trigger, as the API isn't able to wait for a response
    .addInitialiser(AddTwoNumbersMessageProxy, handler => {
        handler.resources.requestTopic = resources.flowExchangeTopic;
        // TODO 30May20: The proxy needs to declare that it requires a trigger, however the event needs a filter that refers to the containing handler, e.g. AddThreeNumbersHandler:Response
        handler.triggers.responseTopic = resources.flowExchangeTopic;
    })
    .addInitialiser(AddThreeNumbersMessageProxy, handler => {
        handler.resources.requestTopic = resources.flowExchangeTopic;
    })
    ;

// TODO 30May20: Should we set the following centrally or per function?

const functionInstanceRepository = 
    new DynamoDbFunctionInstanceRepository(repository => {
        repository.resources.functionInstanceTable = resources.functionInstanceTable;
    });
const exchangeMessagePublisher = new SNSExchangeMessagePublisher(snsClient, process.env.FLOW_EXCHANGE_TOPIC_ARN);
        
export const lambdaApplication = 
    new LambdaApplication(requestRouter, handlerFactory, app => {
        
        // TODO 29May20: We should be able to set CodeUri at this point? DeadLetterQueue? functionNameTemplate?
        app.defaultFunctionNamePrefix = '${ApplicationName}-';

        // TODO 30May20: This should be set on each handler that publishes
        app.exchangeMessagePublisher = exchangeMessagePublisher;

        // TODO 30May20: This should only be necessary when there is a trigger on a handler
        app.functionInstanceRepository = functionInstanceRepository;
        
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
    