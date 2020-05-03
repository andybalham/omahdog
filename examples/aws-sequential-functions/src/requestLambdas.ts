import { SNSEvent } from 'aws-lambda';

import { LambdaActivityRequestHandler } from './omahdog-aws/LambdaActivityRequestHandler';
import { DeadLetterQueueHandler } from './omahdog-aws/DeadLetterQueueHandler';

import { requestRouter, handlerFactory, functionInstanceRepository, exchangeMessagePublisher } from './requestConfiguration';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';

const lambdaActivityRequestHandlerInstance = 
    new LambdaActivityRequestHandler(
        requestRouter, handlerFactory, exchangeMessagePublisher, functionInstanceRepository);

export const addThreeNumbersHandler = async (event: SNSEvent): Promise<void> => {
    await lambdaActivityRequestHandlerInstance.handle(AddThreeNumbersHandler, event);
};

export const sumNumbersHandler = async (event: SNSEvent): Promise<void> => {
    await lambdaActivityRequestHandlerInstance.handle(SumNumbersHandler, event);
};

export const storeTotalHandler = async (event: SNSEvent): Promise<void> => {
    await lambdaActivityRequestHandlerInstance.handle(StoreTotalHandler, event);
};

const deadLetterQueueHandlerInstance = new DeadLetterQueueHandler(exchangeMessagePublisher);

export const deadLetterQueueHandler = async (event: SNSEvent): Promise<void> => {
    await deadLetterQueueHandlerInstance.handle(event);
};