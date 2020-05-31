import DynamoDB from 'aws-sdk/clients/dynamodb';
import SNS from 'aws-sdk/clients/sns';
import { SNSEvent } from 'aws-lambda';

import { ExchangeResponseMessage, ExchangeRequestMessage } from './omahdog-aws/Exchange';
import { DynamoDbFunctionInstanceRepository } from './omahdog-aws/DynamoDbFunctionInstanceRepository';
import { DeadLetterQueueHandler } from './omahdog-aws/DeadLetterQueueHandler';
import { LambdaActivityRequestHandler } from './omahdog-aws/LambdaActivityRequestHandler';
import { SNSExchangeMessagePublisher } from './omahdog-aws/SNSExchangeMessagePublisher';

import { requestRouter } from './requestRouter';
import { handlerFactory } from './lambdaApplication';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';
import { LambdaExchangeWireTap } from './omahdog-aws/LambdaExchangeWireTap';
import { DynamoDBCrudResource, SNSPublishMessageResource } from './omahdog-aws/AwsResources';
import { EnvironmentVariable, ResourceReference } from './omahdog-aws/SAMTemplate';

const documentClient = new DynamoDB.DocumentClient();
const sns = new SNS();

const functionInstanceRepository = 
    new DynamoDbFunctionInstanceRepository(repository => {
        repository.resources.functionInstanceTable = new DynamoDBCrudResource(
            undefined, new EnvironmentVariable(new ResourceReference('FunctionInstanceTable'), 'FLOW_INSTANCE_TABLE_NAME'), documentClient);
    });
const exchangeMessagePublisher = 
    new SNSExchangeMessagePublisher(publisher => {        
        publisher.resources.exchangeTopic = new SNSPublishMessageResource(
            undefined, new EnvironmentVariable(new ResourceReference('FlowExchangeTopicArn'), 'FLOW_EXCHANGE_TOPIC_ARN'), sns);
    });

const deadLetterQueueHandlerInstance = new DeadLetterQueueHandler(exchangeMessagePublisher);
export const deadLetterQueueHandler = async (event: SNSEvent): Promise<void> => {
    await deadLetterQueueHandlerInstance.handle(event);
};

const exchangeWireTapLambda = new LambdaExchangeWireTap();
export const exchangeWireTapHandler = async (event: SNSEvent): Promise<void> => {
    await exchangeWireTapLambda.handle(event);
};

const lambdaActivityRequestHandlerInstance = 
    new LambdaActivityRequestHandler(
        requestRouter, handlerFactory, exchangeMessagePublisher, functionInstanceRepository);

export const addThreeNumbersHandler = async (event: SNSEvent | ExchangeRequestMessage): Promise<void | ExchangeResponseMessage> => {
    return await lambdaActivityRequestHandlerInstance.handle(AddThreeNumbersHandler, event);
};
        
export const addTwoNumbersHandler = async (event: SNSEvent | ExchangeRequestMessage): Promise<void | ExchangeResponseMessage> => {
    return await lambdaActivityRequestHandlerInstance.handle(AddTwoNumbersHandler, event);
};

export const sumNumbersHandler = async (event: SNSEvent | ExchangeRequestMessage): Promise<void | ExchangeResponseMessage> => {
    return await lambdaActivityRequestHandlerInstance.handle(SumNumbersHandler, event);
};

export const storeTotalHandler = async (event: SNSEvent | ExchangeRequestMessage): Promise<void | ExchangeResponseMessage> => {
    return await lambdaActivityRequestHandlerInstance.handle(StoreTotalHandler, event);
};
