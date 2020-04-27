import SNS from 'aws-sdk/clients/sns';
import { SNSEvent } from 'aws-lambda';

import { LambdaActivityRequestHandler } from './omahdog-aws/LambdaActivityRequestHandler';
import { requestRouter, handlerFactory, flowExchangeTopic, functionInstanceRepository } from './requestLambdaCommon';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { StoreTotalResponse } from './exchanges/StoreTotalExchange';

const sns = new SNS();

const addThreeNumbersLambdaHandler = 
    new LambdaActivityRequestHandler(AddThreeNumbersHandler, requestRouter, handlerFactory, sns, flowExchangeTopic, functionInstanceRepository);

export const addThreeNumbersHandler = async (event: SNSEvent): Promise<void> => {
    await addThreeNumbersLambdaHandler.handle<AddThreeNumbersResponse>(event);
};

const sumNumbersLambdaHandler = 
    new LambdaActivityRequestHandler(SumNumbersHandler, requestRouter, handlerFactory, sns, flowExchangeTopic, functionInstanceRepository);

export const sumNumbersHandler = async (event: SNSEvent): Promise<void> => {
    await sumNumbersLambdaHandler.handle<SumNumbersResponse>(event);
};

const storeTotalLambdaHandler = 
    new LambdaActivityRequestHandler(StoreTotalHandler, requestRouter, handlerFactory, sns, flowExchangeTopic, functionInstanceRepository);

export const storeTotalHandler = async (event: SNSEvent): Promise<void> => {
    await storeTotalLambdaHandler.handle<StoreTotalResponse>(event);
};
