import { SNSEvent } from 'aws-lambda';

import { DeadLetterQueueHandler } from './omahdog-aws/DeadLetterQueueHandler';
import { LambdaExchangeWireTap } from './omahdog-aws/LambdaExchangeWireTap';

import { AddNumbersApiControllerRoutes } from './routing';
import { addNumbersExchangeMessagePublisher, addNumbersApplication } from './addNumbersApplication';

import { AddThreeNumbersRequest } from './exchanges/AddThreeNumbersExchange';
import { AddTwoNumbersRequest } from './exchanges/AddTwoNumbersExchange';
import { SumNumbersRequest } from './exchanges/SumNumbersExchange';
import { StoreTotalRequest } from './exchanges/StoreTotalExchange';

// TODO 17Jun20: This needs to be called as addNumbersApplication.handleDeadLetterQueue
const deadLetterQueueHandlerInstance = new DeadLetterQueueHandler(addNumbersExchangeMessagePublisher);
export const deadLetterQueueHandler = async (event: SNSEvent): Promise<void> => {
    await deadLetterQueueHandlerInstance.handle(event);
};

const exchangeWireTapLambda = new LambdaExchangeWireTap();
export const exchangeWireTapHandler = async (event: SNSEvent): Promise<void> => {
    await exchangeWireTapLambda.handle(event);
};

// --------------------------------------------------------------------------------------------------------------

// TODO 29May20: Could we generate the following from the LambdaApplication instance? What about imports?
// TODO 29May20: Could we generate after a specific comment, e.g. // Generated Lambda handlers

export const handleAddNumbersApiControllerRoutes = async (event: any): Promise<any> => {
    return await addNumbersApplication.handleApiEvent(AddNumbersApiControllerRoutes, event);
};

export const handleAddThreeNumbersRequest = async (event: any): Promise<any> => {
    return await addNumbersApplication.handleRequestEvent(AddThreeNumbersRequest, event);
};

export const handleAddTwoNumbersRequest = async (event: any): Promise<any> => {
    return await addNumbersApplication.handleRequestEvent(AddTwoNumbersRequest, event);
};

export const handleSumNumbersRequest = async (event: any): Promise<any> => {
    return await addNumbersApplication.handleRequestEvent(SumNumbersRequest, event);
};

export const handleStoreTotalRequest = async (event: any): Promise<any> => {
    return await addNumbersApplication.handleRequestEvent(StoreTotalRequest, event);
};

// --------------------------------------------------------------------------------------------------------------
    