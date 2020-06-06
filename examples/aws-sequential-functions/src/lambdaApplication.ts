import DynamoDB from 'aws-sdk/clients/dynamodb';
import { Lambda, SNS } from 'aws-sdk';

import { HandlerFactory, IActivityRequestHandlerBase } from './omahdog/FlowContext';
import { ResourceReference, EnvironmentVariable, ResourceAttributeReference, LambdaApplication, FunctionReference } from './omahdog-aws/SAMTemplate';
import { DynamoDBCrudResource, LambdaInvokeResource, SNSPublishMessageResource } from './omahdog-aws/AwsResources';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { SumNumbersLambdaProxy, StoreTotalLambdaProxy, AddTwoNumbersLambdaProxy, AddThreeNumbersLambdaProxy,AddTwoNumbersMessageProxy, AddThreeNumbersMessageProxy, StoreTotalMessageProxy } from './handlerProxies';
import { requestRouter } from './requestRouter';
import { AddNumbersApiControllerRoutes } from './apiControllerRoutes';
import { DynamoDbFunctionInstanceRepository } from './omahdog-aws/DynamoDbFunctionInstanceRepository';
import { SNSExchangeMessagePublisher } from './omahdog-aws/SNSExchangeMessagePublisher';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { RequestHandlerLambda } from './omahdog-aws/RequestHandlerLambda';
import { ApiControllerLambda } from './omahdog-aws/ApiControllerLambda';

const dynamoDbClient = new DynamoDB.DocumentClient();
const lambdaClient = new Lambda();
const snsClient = new SNS();

const templateReferences = {
    addNumbersApiGateway: new ResourceReference('ApiGateway'),
    flowExchangeTopicName: new ResourceAttributeReference('FlowExchangeTopic', 'TopicName'),
    flowResultTable: new ResourceReference('FlowResultTable'),
    flowInstanceTable: new ResourceReference('FlowInstanceTable'),

    addTwoNumbersFunction: new FunctionReference(AddTwoNumbersHandler),
    addThreeNumbersFunction: new FunctionReference(AddThreeNumbersHandler),
    sumNumbersFunction: new FunctionReference(SumNumbersHandler),
    storeTotalFunction: new FunctionReference(StoreTotalHandler),
};

export const exchangeMessagePublisher = new SNSExchangeMessagePublisher(publisher => {        
    publisher.resources.exchangeTopic = new SNSPublishMessageResource(templateReferences.flowExchangeTopicName, snsClient);
});
const functionInstanceRepository = new DynamoDbFunctionInstanceRepository(repository => {
    repository.resources.functionInstanceTable = new DynamoDBCrudResource(templateReferences.flowInstanceTable, dynamoDbClient);
});

const handlerFactory = new HandlerFactory()

    .addInitialiser(StoreTotalHandler, handler => {
        handler.resources.flowResultTable = new DynamoDBCrudResource(templateReferences.flowResultTable, dynamoDbClient);
    })

    .addInitialiser(SumNumbersLambdaProxy, handler => {
        handler.resources.lambda = new LambdaInvokeResource(templateReferences.sumNumbersFunction, lambdaClient);
    })
    .addInitialiser(StoreTotalLambdaProxy, handler => {
        handler.resources.lambda = new LambdaInvokeResource(templateReferences.storeTotalFunction, lambdaClient);
    })
    .addInitialiser(AddTwoNumbersLambdaProxy, handler => {
        handler.resources.lambda = new LambdaInvokeResource(templateReferences.addTwoNumbersFunction, lambdaClient);
    })
    .addInitialiser(AddThreeNumbersLambdaProxy, handler => {
        handler.resources.lambda = new LambdaInvokeResource(templateReferences.addThreeNumbersFunction, lambdaClient);
    })
    
    .addInitialiser(AddTwoNumbersMessageProxy, handler => {
        handler.resources.requestPublisher = exchangeMessagePublisher;
        // handler.triggers.responseTopic = awsResources.flowExchangeTopic;
    })
    .addInitialiser(AddThreeNumbersMessageProxy, handler => {
        handler.resources.requestPublisher = exchangeMessagePublisher;
        // handler.triggers.responseTopic = awsResources.flowExchangeTopic;
    })
    .addInitialiser(StoreTotalMessageProxy, handler => {
        handler.resources.requestPublisher = exchangeMessagePublisher;
        // TODO 31May20: The following would need to cause the right MessageType filter to generate, e.g. AddThreeNumbersHandler:Response
        // handler.triggers.responseTopic = awsResources.flowExchangeTopic;
    })
    ;

const lambdas = {
    // TODO 01Jun20: Why is AddNumbersApiControllerRoutes coming through as undefined?
    addNumbersApiController: new ApiControllerLambda(templateReferences.addNumbersApiGateway, AddNumbersApiControllerRoutes),
    
    // TODO 31May20: The following two need triggers for requests
    addThreeNumbersHandler: new RequestHandlerLambda(templateReferences.addThreeNumbersFunction, lambda => {
        // lambda.triggers.requestTopic = awsResources.flowExchangeTopic;
        lambda.resources.responsePublisher = exchangeMessagePublisher;
        lambda.resources.functionInstanceRepository = functionInstanceRepository;
    }),
    addTwoNumbersHandler: new RequestHandlerLambda(templateReferences.addTwoNumbersFunction, lambda => {
        // lambda.triggers.requestTopic = awsResources.flowExchangeTopic;
        lambda.resources.responsePublisher = exchangeMessagePublisher;
        lambda.resources.functionInstanceRepository = functionInstanceRepository;
    }),

    sumNumbersHandler: new RequestHandlerLambda(templateReferences.sumNumbersFunction, lambda => {
        lambda.resources.responsePublisher = exchangeMessagePublisher;
        lambda.resources.functionInstanceRepository = functionInstanceRepository;
    }),
    storeTotalHandler: new RequestHandlerLambda(templateReferences.storeTotalFunction, lambda => {
        lambda.resources.responsePublisher = exchangeMessagePublisher;
        lambda.resources.functionInstanceRepository = functionInstanceRepository;
    }),
}; 
    
export const lambdaApplication = 
    new LambdaApplication(requestRouter, handlerFactory, application => {
        
        // TODO 29May20: We should be able to set CodeUri at this point? DeadLetterQueue? functionNameTemplate?
        application.defaultFunctionNamePrefix = '${ApplicationName}-';

        // TODO 03Jun20: Should we be able to set defaults for these?
        // lambda.resources.responsePublisher = exchangeMessagePublisher;
        // lambda.resources.functionInstanceRepository = functionInstanceRepository;

        application
            .addApiController(lambdas.addNumbersApiController)
            .addRequestHandler(lambdas.addThreeNumbersHandler)
            .addRequestHandler(lambdas.addTwoNumbersHandler)
            .addRequestHandler(lambdas.sumNumbersHandler)
            .addRequestHandler(lambdas.storeTotalHandler)
        ;
    });

