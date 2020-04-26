import { SNSEvent } from 'aws-lambda';
import { LambdaActivityRequestHandler } from './omahdog-aws/LambdaActivityRequestHandler';
import { requestRouter, handlerFactory, flowExchangeTopic, functionInstanceRepository } from './requestLambdaCommon';

import { AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';

const addThreeNumbersLambdaHandler = 
    new LambdaActivityRequestHandler(AddThreeNumbersHandler, requestRouter, handlerFactory, flowExchangeTopic, functionInstanceRepository);

export const addThreeNumbersHandler = async (event: SNSEvent): Promise<void> => {
    await addThreeNumbersLambdaHandler.handle<AddThreeNumbersResponse>(event);
};

const sumNumbersLambdaHandler = 
    new LambdaActivityRequestHandler(SumNumbersHandler, requestRouter, handlerFactory, flowExchangeTopic, functionInstanceRepository);

export const sumNumbersHandler = async (event: SNSEvent): Promise<void> => {
    await sumNumbersLambdaHandler.handle<SumNumbersResponse>(event);
};
