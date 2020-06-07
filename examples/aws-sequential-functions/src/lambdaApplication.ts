import DynamoDB from 'aws-sdk/clients/dynamodb';
import { Lambda, SNS } from 'aws-sdk';

import { HandlerFactory } from './omahdog/FlowContext';
import { ResourceReference, ResourceAttributeReference, LambdaApplication, FunctionReference } from './omahdog-aws/SAMTemplate';
import { DynamoDBCrudResource, LambdaInvokeResource, SNSPublishMessageResource } from './omahdog-aws/AwsResources';
import { DynamoDbFunctionInstanceRepository } from './omahdog-aws/DynamoDbFunctionInstanceRepository';
import { SNSExchangeMessagePublisher } from './omahdog-aws/SNSExchangeMessagePublisher';
import { RequestHandlerLambda } from './omahdog-aws/RequestHandlerLambda';
import { ApiControllerLambda } from './omahdog-aws/ApiControllerLambda';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { SumNumbersLambdaProxy, StoreTotalLambdaProxy, AddTwoNumbersLambdaProxy, AddThreeNumbersLambdaProxy,AddTwoNumbersMessageProxy, AddThreeNumbersMessageProxy, StoreTotalMessageProxy } from './handlerProxies';
import { AddNumbersApiControllerRoutes, requestRouter } from './routing';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';

const dynamoDbClient = new DynamoDB.DocumentClient();
const lambdaClient = new Lambda();
const snsClient = new SNS();

const templateReferences = {
    addNumbersApiGateway: new ResourceReference('ApiGateway'),
    addNumbersExchangeTopicName: new ResourceAttributeReference('FlowExchangeTopic', 'TopicName'),
    flowResultTable: new ResourceReference('FlowResultTable'),
    flowInstanceTable: new ResourceReference('FlowInstanceTable'),

    addTwoNumbersFunction: new FunctionReference(AddTwoNumbersHandler),
    addThreeNumbersFunction: new FunctionReference(AddThreeNumbersHandler),
    sumNumbersFunction: new FunctionReference(SumNumbersHandler),
    storeTotalFunction: new FunctionReference(StoreTotalHandler),
};

export const addNumbersExchangeMessagePublisher = new SNSExchangeMessagePublisher(publisher => {        
    publisher.resources.exchangeTopic = new SNSPublishMessageResource(templateReferences.addNumbersExchangeTopicName, snsClient);
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
        handler.resources.requestPublisher = addNumbersExchangeMessagePublisher;
        // handler.triggers.responseTopic = awsResources.flowExchangeTopic;
    })
    .addInitialiser(AddThreeNumbersMessageProxy, handler => {
        handler.resources.requestPublisher = addNumbersExchangeMessagePublisher;
        // handler.triggers.responseTopic = awsResources.flowExchangeTopic;
    })
    .addInitialiser(StoreTotalMessageProxy, handler => {
        handler.resources.requestPublisher = addNumbersExchangeMessagePublisher;
        // TODO 31May20: The following would need to cause the right MessageType filter to generate, e.g. AddThreeNumbersHandler:Response
        // handler.triggers.responseTopic = awsResources.flowExchangeTopic;
    })
    ;
    
export const lambdaApplication = 
    new LambdaApplication(requestRouter, handlerFactory, application => {
        
        // TODO 29May20: We should be able to set CodeUri at this point? DeadLetterQueue? functionNameTemplate?
        application.defaultFunctionNamePrefix = '${ApplicationName}-';

        // TODO 07Jun20: Supply a defaultRequestTopic, so that the lambdas can be triggered
        // application.defaultRequestTopic = awsResources.flowExchangeTopic;
        application.defaultResponsePublisher = addNumbersExchangeMessagePublisher;
        application.defaultFunctionInstanceRepository = functionInstanceRepository;

        application
            .addApiController(new ApiControllerLambda(templateReferences.addNumbersApiGateway, AddNumbersApiControllerRoutes))

            .addRequestHandler(new RequestHandlerLambda(templateReferences.addThreeNumbersFunction))
            .addRequestHandler(new RequestHandlerLambda(templateReferences.addTwoNumbersFunction))
            .addRequestHandler(new RequestHandlerLambda(templateReferences.sumNumbersFunction))
            .addRequestHandler(new RequestHandlerLambda(templateReferences.storeTotalFunction))
        ;
    });

