import { SNSEvent } from 'aws-lambda';

import { ExchangeResponseMessage, ExchangeRequestMessage } from './omahdog-aws/Exchange';
import { DeadLetterQueueHandler } from './omahdog-aws/DeadLetterQueueHandler';
import { LambdaActivityRequestHandler } from './omahdog-aws/LambdaActivityRequestHandler';

import { requestRouter } from './requestRouter';
import { handlerFactory, exchangeMessagePublisher, functionInstanceRepository } from './lambdaApplication';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';
import { LambdaExchangeWireTap } from './omahdog-aws/LambdaExchangeWireTap';

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
