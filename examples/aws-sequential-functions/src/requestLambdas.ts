import { SNSEvent } from 'aws-lambda';

import { lambdaActivityRequestHandlerInstance, deadLetterQueueHandlerInstance } from './requestConfiguration';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';

export const addThreeNumbersHandler = async (event: SNSEvent): Promise<void> => {
    await lambdaActivityRequestHandlerInstance.handle(AddThreeNumbersHandler, event);
};

export const sumNumbersHandler = async (event: SNSEvent): Promise<void> => {
    await lambdaActivityRequestHandlerInstance.handle(SumNumbersHandler, event);
};

export const storeTotalHandler = async (event: SNSEvent): Promise<void> => {
    await lambdaActivityRequestHandlerInstance.handle(StoreTotalHandler, event);
};

export const deadLetterQueueHandler = async (event: SNSEvent): Promise<void> => {
    await deadLetterQueueHandlerInstance.handle(event);
};