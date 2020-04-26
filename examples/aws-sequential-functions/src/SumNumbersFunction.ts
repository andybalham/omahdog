import { SNSEvent } from 'aws-lambda';

import { LambdaActivityRequestHandler } from './omahdog-aws/LambdaActivityRequestHandler';

import { requestRouter, flowExchangeTopic, functionInstanceRepository, handlerFactory } from './FunctionsCommon';

import { SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';

const activityRequestHandler = 
    new LambdaActivityRequestHandler(SumNumbersHandler, requestRouter, handlerFactory, flowExchangeTopic, functionInstanceRepository);

export const handler = async (event: SNSEvent): Promise<void> => {
    await activityRequestHandler.handle<SumNumbersResponse>(event);
};
