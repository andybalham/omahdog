import { SNSEvent } from 'aws-lambda';

import { DeadLetterQueueHandler } from './omahdog-aws/DeadLetterQueueHandler';

import { addNumbersExchangeMessagePublisher, addNumbersApplication } from './lambdaApplication';
import { LambdaExchangeWireTap } from './omahdog-aws/LambdaExchangeWireTap';
import { AddNumbersApiControllerRoutes } from './routing';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { AddThreeNumbersRequest } from './exchanges/AddThreeNumbersExchange';
import { AddTwoNumbersRequest } from './exchanges/AddTwoNumbersExchange';
import { SumNumbersRequest } from './exchanges/SumNumbersExchange';
import { StoreTotalRequest } from './exchanges/StoreTotalExchange';

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

export const addNumbersApiControllerRoutes = async (event: any): Promise<any> => {
    return await addNumbersApplication.handleApiEvent(AddNumbersApiControllerRoutes, event);
};

export const addThreeNumbersHandler = async (event: any): Promise<any> => {
    return await addNumbersApplication.handleRequestEvent(AddThreeNumbersRequest, event);
};

export const addTwoNumbersHandler = async (event: any): Promise<any> => {
    return await addNumbersApplication.handleRequestEvent(AddTwoNumbersRequest, event);
};

export const sumNumbersHandler = async (event: any): Promise<any> => {
    return await addNumbersApplication.handleRequestEvent(SumNumbersRequest, event);
};

export const storeTotalHandler = async (event: any): Promise<any> => {
    return await addNumbersApplication.handleRequestEvent(StoreTotalRequest, event);
};

// --------------------------------------------------------------------------------------------------------------
    