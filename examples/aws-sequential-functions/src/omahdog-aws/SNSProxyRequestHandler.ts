import uuid = require('uuid');
import { FlowContext, IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowContext';
import { FlowRequestMessage } from './FlowMessage';
import { SNSExchangeMessagePublisher } from './SNSExchangeMessagePublisher';
import { TemplateReference } from './TemplateReferences';
import { SNSPublishMessageService } from './AwsServices';

class SNSProxyRequestHandlerParameters {
    responseTopic?: TemplateReference
}

export class SNSProxyRequestHandler<TReq, TRes> implements IActivityRequestHandler<TReq, TRes> {

    // TODO 04Aug20: Validate the following
    parameters = new SNSProxyRequestHandlerParameters

    services = {
        requestService: new SNSPublishMessageService
    }

    isAsync = true;

    private readonly requestTypeName: string;

    constructor(requestType: new() => TReq) {
        this.requestTypeName = requestType.name;
    }

    validate(): string[] {

        const errorMessages = new Array<string>();
        
        if (this.parameters.responseTopic === undefined) errorMessages.push('this.parameters.responseTopic === undefined');

        return errorMessages;
    }

    // TODO 05Jul20: We could change this to be getResponseEvents, this would indicate async nature
    
    getEvents(callbackId?: any): any[] {

        if (callbackId === undefined) {
            return [];
        }

        const responseEvent = {
            Type: 'SNS',
            Properties: {
                Topic: {},
                FilterPolicy: {
                    MessageType: {}
                }
            },
        };

        responseEvent.Properties.Topic = this.parameters.responseTopic?.instance;
        responseEvent.Properties.FilterPolicy.MessageType = [callbackId];

        return [responseEvent];
    }

    async handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse> {
        
        const requestId = uuid.v4();
        
        const message: FlowRequestMessage = 
            {
                callContext: flowContext.callContext,
                callbackId: flowContext.requesterId,
                requestId: requestId,
                request: request
            };

        const requestPublisher = new SNSExchangeMessagePublisher(p => {
            p.services.exchangeTopic = this.services.requestService;
        });

        await requestPublisher.publishRequest(this.requestTypeName, message);

        return flowContext.getAsyncResponse(requestId);
    }
}
