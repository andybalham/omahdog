import DynamoDB from 'aws-sdk/clients/dynamodb';
import SNS from 'aws-sdk/clients/sns';
import { SNSEvent } from 'aws-lambda';

import { AsyncResponseMessage, AsyncRequestMessage } from './omahdog-aws/AsyncExchange';
import { DynamoDbFunctionInstanceRepository } from './omahdog-aws/DynamoDbFunctionInstanceRepository';
import { DeadLetterQueueHandler } from './omahdog-aws/DeadLetterQueueHandler';
import { LambdaActivityRequestHandler } from './omahdog-aws/LambdaActivityRequestHandler';
import { SNSExchangeMessagePublisher } from './omahdog-aws/SNSExchangeMessagePublisher';

import { requestRouter, handlerFactory } from './requestConfiguration';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';

const documentClient = new DynamoDB.DocumentClient();
const sns = new SNS();

const functionInstanceRepository = new DynamoDbFunctionInstanceRepository(documentClient, process.env.FLOW_INSTANCE_TABLE_NAME);
const exchangeMessagePublisher = new SNSExchangeMessagePublisher(sns, process.env.FLOW_EXCHANGE_TOPIC_ARN);

const lambdaActivityRequestHandlerInstance = 
    new LambdaActivityRequestHandler(
        requestRouter, handlerFactory, exchangeMessagePublisher, functionInstanceRepository);

const deadLetterQueueHandlerInstance = new DeadLetterQueueHandler(exchangeMessagePublisher);

export const addThreeNumbersHandler = async (event: SNSEvent | AsyncRequestMessage): Promise<void | AsyncResponseMessage> => {
    return await lambdaActivityRequestHandlerInstance.handle(AddThreeNumbersHandler, event);
};

export const addTwoNumbersHandler = async (event: SNSEvent | AsyncRequestMessage): Promise<void | AsyncResponseMessage> => {
    return await lambdaActivityRequestHandlerInstance.handle(AddTwoNumbersHandler, event);
};

export const sumNumbersHandler = async (event: SNSEvent | AsyncRequestMessage): Promise<void | AsyncResponseMessage> => {
    return await lambdaActivityRequestHandlerInstance.handle(SumNumbersHandler, event);
};

export const storeTotalHandler = async (event: SNSEvent | AsyncRequestMessage): Promise<void | AsyncResponseMessage> => {
    return await lambdaActivityRequestHandlerInstance.handle(StoreTotalHandler, event);
};

export const deadLetterQueueHandler = async (event: SNSEvent): Promise<void> => {
    await deadLetterQueueHandlerInstance.handle(event);
};