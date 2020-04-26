import { SNSEvent } from 'aws-lambda';
import { LambdaActivityRequestHandler } from './omahdog-aws/LambdaActivityRequestHandler';
import { flowExchangeTopic, requestRouter, functionInstanceRepository, handlerFactory } from './FunctionsCommon';
import { AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';

const addThreeNumbersLambdaHandler = 
    new LambdaActivityRequestHandler(AddThreeNumbersHandler, requestRouter, handlerFactory, flowExchangeTopic, functionInstanceRepository);

export const handler = async (event: SNSEvent): Promise<void> => {
    await addThreeNumbersLambdaHandler.handle<AddThreeNumbersResponse>(event);
};

// TODO 25Apr20: Test if this still works

// TODO 25Apr20: Test if we can have both handlers in this module
