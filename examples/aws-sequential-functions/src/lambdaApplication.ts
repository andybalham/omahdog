import DynamoDB from 'aws-sdk/clients/dynamodb';
import { Lambda, SNS } from 'aws-sdk';

import { HandlerFactory } from './omahdog/FlowContext';
import { ResourceReference, ResourceAttributeReference, LambdaApplication } from './omahdog-aws/SAMTemplate';
import { DynamoDBCrudService, LambdaInvokeService, SNSPublishMessageService } from './omahdog-aws/AwsServices';
import { DynamoDbFunctionInstanceRepository } from './omahdog-aws/DynamoDbFunctionInstanceRepository';
import { SNSExchangeMessagePublisher } from './omahdog-aws/SNSExchangeMessagePublisher';
import { RequestHandlerLambda } from './omahdog-aws/RequestHandlerLambda';
import { ApiControllerLambda } from './omahdog-aws/ApiControllerLambda';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { SumNumbersLambdaProxy, StoreTotalLambdaProxy, AddTwoNumbersLambdaProxy, AddThreeNumbersLambdaProxy,AddTwoNumbersMessageProxy, AddThreeNumbersMessageProxy, StoreTotalMessageProxy } from './handlerProxies';
import { AddNumbersApiControllerRoutes, requestRouter } from './routing';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddTwoNumbersRequest, AddTwoNumbersResponse } from './exchanges/AddTwoNumbersExchange';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { StoreTotalRequest, StoreTotalResponse } from './exchanges/StoreTotalExchange';

const dynamoDbClient = new DynamoDB.DocumentClient();
const lambdaClient = new Lambda();
const snsClient = new SNS();

const templateReferences = {
    addNumbersApiGateway: new ResourceReference('ApiGateway'),
    addNumbersExchangeTopicName: new ResourceAttributeReference('FlowExchangeTopic', 'TopicName'),
    addNumbersInstanceTable: new ResourceReference('FlowInstanceTable'),
    addNumbersResultTable: new ResourceReference('FlowResultTable'),

    addTwoNumbersFunction: new ResourceReference('AddTwoNumbersFunction'),
    addThreeNumbersFunction: new ResourceReference('AddThreeNumbersFunction'),
    sumNumbersFunction: new ResourceReference('SumNumbersFunction'),
    storeTotalFunction: new ResourceReference('StoreTotalFunction'),
};

export const addNumbersExchangeMessagePublisher = new SNSExchangeMessagePublisher(publisher => {        
    publisher.services.exchangeTopic = new SNSPublishMessageService(templateReferences.addNumbersExchangeTopicName, snsClient);
});

const handlerFactory = new HandlerFactory()

    .addInitialiser(StoreTotalHandler, handler => {
        handler.services.dynamoDb = new DynamoDBCrudService(templateReferences.addNumbersResultTable, dynamoDbClient);
    })

    .addInitialiser(SumNumbersLambdaProxy, handler => {
        handler.services.lambda = new LambdaInvokeService(templateReferences.sumNumbersFunction, lambdaClient);
    })
    .addInitialiser(StoreTotalLambdaProxy, handler => {
        handler.services.lambda = new LambdaInvokeService(templateReferences.storeTotalFunction, lambdaClient);
    })
    .addInitialiser(AddTwoNumbersLambdaProxy, handler => {
        handler.services.lambda = new LambdaInvokeService(templateReferences.addTwoNumbersFunction, lambdaClient);
    })
    .addInitialiser(AddThreeNumbersLambdaProxy, handler => {
        handler.services.lambda = new LambdaInvokeService(templateReferences.addThreeNumbersFunction, lambdaClient);
    })
    
    .addInitialiser(AddTwoNumbersMessageProxy, handler => {
        handler.services.requestPublisher = addNumbersExchangeMessagePublisher;
        // handler.triggers.responseTopic = awsServices.flowExchangeTopic;
    })
    .addInitialiser(AddThreeNumbersMessageProxy, handler => {
        handler.services.requestPublisher = addNumbersExchangeMessagePublisher;
        // handler.triggers.responseTopic = awsServices.flowExchangeTopic;
    })
    .addInitialiser(StoreTotalMessageProxy, handler => {
        handler.services.requestPublisher = addNumbersExchangeMessagePublisher;
        // TODO 31May20: The following would need to cause the right MessageType filter to generate, e.g. AddThreeNumbersHandler:Response
        // handler.triggers.responseTopic = awsServices.flowExchangeTopic;
    })
    ;
    
export const addNumbersApplication = 
    new LambdaApplication(requestRouter, handlerFactory, application => {
        
        // TODO 29May20: We should be able to set CodeUri at this point? DeadLetterQueue? functionNameTemplate?
        application.defaultFunctionNamePrefix = '${ApplicationName}-';

        // TODO 07Jun20: Supply a defaultRequestTopic, so that the lambdas can be triggered
        // application.defaultRequestTopic = awsServices.flowExchangeTopic;

        application.defaultResponsePublisher = addNumbersExchangeMessagePublisher;
        
        application.defaultFunctionInstanceRepository = new DynamoDbFunctionInstanceRepository(repository => {
            repository.services.functionInstanceTable = new DynamoDBCrudService(templateReferences.addNumbersInstanceTable, dynamoDbClient);
        });

        application
            .addApiController(
                new ApiControllerLambda(templateReferences.addNumbersApiGateway, AddNumbersApiControllerRoutes))

            .addRequestHandler(
                new RequestHandlerLambda(
                    templateReferences.addThreeNumbersFunction, AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersHandler))
            .addRequestHandler(
                new RequestHandlerLambda(
                    templateReferences.addTwoNumbersFunction, AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersHandler))
            .addRequestHandler(
                new RequestHandlerLambda(
                    templateReferences.sumNumbersFunction, SumNumbersRequest, SumNumbersResponse, SumNumbersHandler))
            .addRequestHandler(
                new RequestHandlerLambda(
                    templateReferences.storeTotalFunction, StoreTotalRequest, StoreTotalResponse, StoreTotalHandler))
        ;
    });

