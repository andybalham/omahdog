import DynamoDB from 'aws-sdk/clients/dynamodb';
import { Lambda, SNS } from 'aws-sdk';

import { HandlerFactory } from './omahdog/FlowContext';
import { LambdaApplication, FunctionNamePrefix } from './omahdog-aws/LambdaApplication';
import { DynamoDBCrudService, LambdaInvokeService, SNSPublishMessageService } from './omahdog-aws/AwsServices';
import { DynamoDbFunctionInstanceRepository } from './omahdog-aws/DynamoDbFunctionInstanceRepository';
import { SNSExchangeMessagePublisher } from './omahdog-aws/SNSExchangeMessagePublisher';

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
import { ResourceReference, ResourceReferenceAttribute, ParameterReference } from './omahdog-aws/TemplateReferences';
import { EnvironmentVariable, ConstantValue } from './omahdog-aws/ConfigurationValues';

const dynamoDbClient = new DynamoDB.DocumentClient();
const lambdaClient = new Lambda();
const snsClient = new SNS();

const templateReferences = {
    applicationName: new ParameterReference('ApplicationName'),

    addNumbersApiGateway: new ResourceReference('ApiGateway'),
    addNumbersExchangeTopic: new ResourceReference('FlowExchangeTopic'),
    addNumbersInstanceTable: new ResourceReference('FlowInstanceTable'),
    addNumbersResultTable: new ResourceReference('FlowResultTable'),

    addTwoNumbersFunction: new ResourceReference('AddTwoNumbersFunction'),
    addThreeNumbersFunction: new ResourceReference('AddThreeNumbersFunction'),
    sumNumbersFunction: new ResourceReference('SumNumbersFunction'),
    storeTotalFunction: new ResourceReference('StoreTotalFunction'),
};

export const addNumbersExchangeMessagePublisher = new SNSExchangeMessagePublisher(publisher => {        
    publisher.services.exchangeTopic = 
        new SNSPublishMessageService(templateReferences.addNumbersExchangeTopic.attribute('TopicName'), snsClient);
});

const handlerFactory = new HandlerFactory()

    .setInitialiser(StoreTotalHandler, handler => {
        handler.services.dynamoDb = new DynamoDBCrudService(templateReferences.addNumbersResultTable, dynamoDbClient);
    })
    .setInitialiser(AddThreeNumbersHandler, handler => {
        handler.parameters.totalDescription = new ConstantValue('Life, the universe etc.');
    })

    .setInitialiser(SumNumbersLambdaProxy, handler => {
        handler.services.lambda = new LambdaInvokeService(templateReferences.sumNumbersFunction, lambdaClient);
    })
    .setInitialiser(StoreTotalLambdaProxy, handler => {
        handler.services.lambda = new LambdaInvokeService(templateReferences.storeTotalFunction, lambdaClient);
    })
    .setInitialiser(AddTwoNumbersLambdaProxy, handler => {
        handler.services.lambda = new LambdaInvokeService(templateReferences.addTwoNumbersFunction, lambdaClient);
    })
    .setInitialiser(AddThreeNumbersLambdaProxy, handler => {
        handler.services.lambda = new LambdaInvokeService(templateReferences.addThreeNumbersFunction, lambdaClient);
    })
    
    .setInitialiser(AddTwoNumbersMessageProxy, handler => {
        handler.services.requestPublisher = addNumbersExchangeMessagePublisher;
    })
    .setInitialiser(AddThreeNumbersMessageProxy, handler => {
        handler.services.requestPublisher = addNumbersExchangeMessagePublisher;
    })
    .setInitialiser(StoreTotalMessageProxy, handler => {
        handler.services.requestPublisher = addNumbersExchangeMessagePublisher;
    })
    ;
    
export const addNumbersApplication = 
    new LambdaApplication(requestRouter, handlerFactory, application => {
        
        // TODO 29May20: Add default DeadLetterQueue

        application.functionNamePrefix = new FunctionNamePrefix('-', templateReferences.applicationName);

        application.defaultResponsePublisher = addNumbersExchangeMessagePublisher;
        application.defaultRequestTopic = templateReferences.addNumbersExchangeTopic;
        
        application.defaultFunctionInstanceRepository = new DynamoDbFunctionInstanceRepository(repository => {
            repository.services.functionInstanceTable = new DynamoDBCrudService(templateReferences.addNumbersInstanceTable, dynamoDbClient);
        });

        application
            .addApiController(templateReferences.addNumbersApiGateway, AddNumbersApiControllerRoutes)

            .addRequestHandler(
                templateReferences.addThreeNumbersFunction, AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersHandler)
            .addRequestHandler(
                templateReferences.addTwoNumbersFunction, AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersHandler)
            .addRequestHandler(
                templateReferences.sumNumbersFunction, SumNumbersRequest, SumNumbersResponse, SumNumbersHandler)
            .addRequestHandler(
                templateReferences.storeTotalFunction, StoreTotalRequest, StoreTotalResponse, StoreTotalHandler)
        ;
    });

