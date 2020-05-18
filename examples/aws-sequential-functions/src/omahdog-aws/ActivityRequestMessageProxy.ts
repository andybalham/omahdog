import uuid = require('uuid');
import { FlowContext, IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowContext';
import { ExchangeRequestMessage } from './Exchange';
import { IExchangeMessagePublisher } from './IExchangeMessagePublisher';

// TODO 10May20: Make this SNSProxy and use SNS directly?
export class ActivityRequestHandlerMessageProxy<TReq, TRes> implements IActivityRequestHandler<TReq, TRes> {

    private readonly requestTypeName: string;
    private readonly exchangeMessagePublisher?: IExchangeMessagePublisher;

    constructor(requestType: new() => TReq, _responseType: new() => TRes, exchangeMessagePublisher?: IExchangeMessagePublisher) {
        this.requestTypeName = requestType.name;
        this.exchangeMessagePublisher = exchangeMessagePublisher;
    }

    async handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse> {
        
        if (this.exchangeMessagePublisher === undefined) throw new Error('this._exchangeMessagePublisher === undefined');
        
        const requestId = uuid.v4();
        
        const message: ExchangeRequestMessage = 
            {
                callingContext: {
                    requestId: requestId,
                    flowInstanceId: flowContext.instanceId,
                    flowCorrelationId: flowContext.correlationId,
                    handlerTypeName: flowContext.rootHandlerTypeName
                },
                request: request
            };

        await this.exchangeMessagePublisher.publishRequest(this.requestTypeName, message);

        return flowContext.getAsyncResponse(requestId);
    }
}
