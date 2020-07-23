import DynamoDB from 'aws-sdk/clients/dynamodb';
import { Lambda, SNS } from 'aws-sdk';

import { HandlerFactory } from './omahdog/FlowContext';
import { LambdaApplication, FunctionNamePrefix } from './omahdog-aws/LambdaApplication';
import { DynamoDBCrudService, LambdaInvokeService, SNSPublishMessageService } from './omahdog-aws/AwsServices';
import { DynamoDbFunctionInstanceRepository } from './omahdog-aws/DynamoDbFunctionInstanceRepository';
import { SNSExchangeMessagePublisher } from './omahdog-aws/SNSExchangeMessagePublisher';
import { ResourceReference, ParameterReference, TemplateReference } from './omahdog-aws/TemplateReferences';
import { ConstantValue, EnvironmentVariable } from './omahdog-aws/ConfigurationValues';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { SumNumbersLambdaProxy, AddTwoNumbersLambdaProxy, AddThreeNumbersLambdaProxy,AddTwoNumbersMessageProxy, AddThreeNumbersMessageProxy, StoreTotalMessageProxy } from './handlerProxies';
import { AddNumbersApiControllerRoutes, requestRouter } from './routing';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddTwoNumbersRequest, AddTwoNumbersResponse } from './exchanges/AddTwoNumbersExchange';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { StoreTotalRequest, StoreTotalResponse } from './exchanges/StoreTotalExchange';
import { RequestHandlerLambda } from './omahdog-aws/RequestHandlerLambda';
import { constants } from 'zlib';

const dynamoDbClient = new DynamoDB.DocumentClient();
const lambdaClient = new Lambda();
const snsClient = new SNS();

const templateReferences = {
    applicationName: new ParameterReference('ApplicationName'),

    addNumbersApiGateway: ResourceReference.awsServerlessApi('ApiGateway'),
    addNumbersExchangeTopic: ResourceReference.awsSNSTopic('FlowExchangeTopic'),
    addNumbersInstanceTable: ResourceReference.awsServerlessSimpleTable('FlowInstanceTable'),
    addNumbersResultTable: ResourceReference.awsServerlessSimpleTable('FlowResultTable'),

    addNumbersApiFunction: ResourceReference.awsServerlessFunction('AddNumbersApiFunction'),
    addTwoNumbersFunction: ResourceReference.awsServerlessFunction('AddTwoNumbersFunction'),
    addThreeNumbersFunction: ResourceReference.awsServerlessFunction('AddThreeNumbersFunction'),
    sumNumbersFunction: ResourceReference.awsServerlessFunction('SumNumbersFunction'),
    storeTotalFunction: ResourceReference.awsServerlessFunction('StoreTotalFunction'),
};

// TODO 29Jun20: We are only exporting this for the dead letter queue and wiretap lambdas
export const addNumbersExchangeMessagePublisher = new SNSExchangeMessagePublisher(publisher => {        
    publisher.services.exchangeTopic = 
        new SNSPublishMessageService(
            templateReferences.addNumbersExchangeTopic.attribute('TopicName'), snsClient);
});

const dynamoDbFunctionInstanceRepository = new DynamoDbFunctionInstanceRepository(repository => {
    repository.services.functionInstanceTable = new DynamoDBCrudService(templateReferences.addNumbersInstanceTable, dynamoDbClient);
});

const handlerFactory = new HandlerFactory()

    .setInitialiser(StoreTotalHandler, handler => {
        handler.services.dynamoDb = new DynamoDBCrudService(templateReferences.addNumbersResultTable, dynamoDbClient);
    })
    .setInitialiser(AddThreeNumbersHandler, handler => {
        handler.parameters.totalDescription = new ConstantValue('Life, the universe, and everything');
    })

    .setInitialiser(SumNumbersLambdaProxy, handler => {
        handler.services.lambda = new LambdaInvokeService(templateReferences.sumNumbersFunction, lambdaClient);
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

        application.defaultRequestTopic = templateReferences.addNumbersExchangeTopic;
        application.defaultResponsePublisher = addNumbersExchangeMessagePublisher;
        
        application.defaultFunctionInstanceRepository = dynamoDbFunctionInstanceRepository;

        application

            .addApiController(
                templateReferences.addNumbersApiFunction, templateReferences.addNumbersApiGateway, AddNumbersApiControllerRoutes)
    
            .addRequestHandler(
                templateReferences.addThreeNumbersFunction, AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersHandler, lambda => {
                    lambda.enableSNS = true;
                })
            .addRequestHandler(
                templateReferences.addTwoNumbersFunction, AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersHandler, lambda => {
                    lambda.enableSNS = true;
                })
            .addRequestHandler(
                templateReferences.sumNumbersFunction, SumNumbersRequest, SumNumbersResponse, SumNumbersHandler)
            .addRequestHandler(
                templateReferences.storeTotalFunction, StoreTotalRequest, StoreTotalResponse, StoreTotalHandler, lambda => {
                    lambda.enableSNS = true;
                })
        ;
    });

