import uuid = require('uuid');
import { FlowContext, IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowContext';
import { ExchangeRequestMessage } from './Exchange';
import { SNSTopicPublishService } from './AwsServices';
import { SNSExchangeMessagePublisher } from './SNSExchangeMessagePublisher';

// TODO 10May20: Make this SNSProxy and use SNS directly?
export class SNSProxyRequestHandler<TReq, TRes> implements IActivityRequestHandler<TReq, TRes> {

    services = {
        requestTopic: new SNSTopicPublishService
    }    

    private readonly requestTypeName: string;

    constructor(requestType: new() => TReq) {
        this.requestTypeName = requestType.name;
    }

    async handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse> {
        
        if (this.services.requestTopic.sns === undefined) throw new Error('this.services.requestTopic.sns === undefined');
        if (this.services.requestTopic.topicArn === undefined) throw new Error('this.services.requestTopic.topicArn === undefined');

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

        const publisher = new SNSExchangeMessagePublisher(this.services.requestTopic.sns, this.services.requestTopic.topicArn);

        await publisher.publishRequest(this.requestTypeName, message);

        return flowContext.getAsyncResponse(requestId);
    }
}
