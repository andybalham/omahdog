import uuid = require('uuid');
import { FlowContext, IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowContext';
import { FlowRequestMessage } from './FlowMessage';
import { SNSExchangeMessagePublisher } from './SNSExchangeMessagePublisher';

export class SNSProxyRequestHandler<TReq, TRes> implements IActivityRequestHandler<TReq, TRes> {

    isAsync = true;

    services = {
        requestPublisher: new SNSExchangeMessagePublisher
    }

    private readonly requestTypeName: string;

    constructor(requestType: new() => TReq) {
        this.requestTypeName = requestType.name;
    }

    // TODO 05Jul20: We could change this to be getResponseEvents, this would indicate async nature
    
    getEvents(requesterId: string): any[] {

        const responseEvent = {
            Type: 'SNS',
            Properties: {
                Topic: undefined,
                FilterPolicy: {
                    MessageType: new Array<string>()
                }
            },
        };

        responseEvent.Properties.Topic = this.services?.requestPublisher.services.exchangeTopic.parameters.topicArnValue?.getTemplateValue();
        responseEvent.Properties.FilterPolicy.MessageType = [`${requesterId}:Response`];

        return [responseEvent];
    }

    async handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse> {
        
        const requestId = uuid.v4();
        
        const message: FlowRequestMessage = 
            {
                callContext: flowContext.callContext,
                requesterId: flowContext.requesterId,
                requestId: requestId,
                request: request
            };

        await this.services.requestPublisher.publishRequest(this.requestTypeName, message);

        return flowContext.getAsyncResponse(requestId);
    }
}
