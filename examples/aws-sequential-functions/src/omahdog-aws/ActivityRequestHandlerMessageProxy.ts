import uuid = require('uuid');
import { FlowContext, IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowContext';
import { AsyncRequestMessage } from './AsyncExchange';
import { IExchangeMessagePublisher } from './IExchangeMessagePublisher';

export class ActivityRequestHandlerMessageProxy<TReq, TRes> implements IActivityRequestHandler<TReq, TRes> {

    private readonly _RequestType: new() => TReq;
    private readonly _exchangeMessagePublisher?: IExchangeMessagePublisher;

    constructor(RequestType: new() => TReq, _ResponseType: new() => TRes, exchangeMessagePublisher?: IExchangeMessagePublisher) {
        this._RequestType = RequestType;
        this._exchangeMessagePublisher = exchangeMessagePublisher;
    }

    async handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse> {
        
        if (this._exchangeMessagePublisher === undefined) throw new Error('this._exchangeMessagePublisher === undefined');
        
        const requestId = uuid.v4();
        
        const message: AsyncRequestMessage = 
            {
                callingContext: {
                    requestId: requestId,
                    flowInstanceId: flowContext.instanceId,
                    flowCorrelationId: flowContext.correlationId,
                    flowTypeName: flowContext.rootStackFrame.flowTypeName
                },
                request: request
            };

        await this._exchangeMessagePublisher.publishRequest(this._RequestType.name, message);

        return flowContext.getAsyncResponse(requestId);
    }
}
