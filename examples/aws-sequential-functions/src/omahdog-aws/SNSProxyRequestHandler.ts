import uuid = require('uuid');
import { FlowContext, IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowContext';
import { ExchangeRequestMessage } from './Exchange';
import { SNSPublishMessageService } from './AwsServices';
import { SNSExchangeMessagePublisher } from './SNSExchangeMessagePublisher';

// TODO 10May20: Make this SNSProxy and use SNS directly?
export class SNSProxyRequestHandler<TReq, TRes> implements IActivityRequestHandler<TReq, TRes> {

    // TODO 30May20: Need to be able to define that the root handler will need to subscribe for response events
    triggers: any;

    services = {
        requestPublisher: new SNSExchangeMessagePublisher
    }

    private readonly requestTypeName: string;

    constructor(requestType: new() => TReq) {
        this.requestTypeName = requestType.name;
    }

    async handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse> {
        
        this.services.requestPublisher.throwErrorIfInvalid();

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

        await this.services.requestPublisher.publishRequest(this.requestTypeName, message);

        return flowContext.getAsyncResponse(requestId);
    }
}
