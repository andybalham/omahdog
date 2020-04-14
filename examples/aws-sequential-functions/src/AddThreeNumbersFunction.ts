import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { FlowContext } from './omahdog/FlowContext';
import { FlowHandlers } from './omahdog/FlowHandlers';
import { SumNumbersRequest, SumNumbersResponse } from './exchanges/SumNumbersExchange';
import { SumNumbersHandler } from './handlers/SumNumbersHandler';
import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';

const handlers = new FlowHandlers()
    .register(SumNumbersRequest, SumNumbersResponse, new SumNumbersHandler());
    
export const handler = async (event: AddThreeNumbersRequest): Promise<AddThreeNumbersResponse | undefined> => {

    const flowContext = new FlowContext();
    flowContext.handlers = handlers;

    const response = new AddThreeNumbersHandler().handle(flowContext, event);
    
    return response;
};