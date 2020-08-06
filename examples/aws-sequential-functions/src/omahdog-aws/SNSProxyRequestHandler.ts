import uuid = require('uuid');
import { FlowContext, IActivityRequestHandler, AsyncResponse } from '../omahdog/FlowContext';
import { FlowRequestMessage } from './FlowMessage';
import { ResponseMessagePublisher } from './ResponseMessagePublisher';
import { TemplateReference } from './TemplateReferences';
import { SNSPublishMessageService } from './AwsServices';
import { PublishInput } from 'aws-sdk/clients/sns';

class SNSProxyRequestHandlerParameters {
    responseTopic?: TemplateReference
}

export class SNSProxyRequestHandler<TReq, TRes> implements IActivityRequestHandler<TReq, TRes> {

    parameters = new SNSProxyRequestHandlerParameters

    services = {
        requestPublisher: new SNSPublishMessageService
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

    getEvents(callbackId?: any): any[] {

        const responseEvent = {
            Type: 'SNS',
            Properties: {
                Topic: this.parameters.responseTopic?.instance,
                FilterPolicy: {
                    CallbackId: [callbackId]
                }
            },
        };

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

        const requestPublisher = new ResponseMessagePublisher(p => {
            p.services.exchangeTopic = this.services.requestPublisher;
        });

        await this.publishRequest(this.requestTypeName, message);

        return flowContext.getAsyncResponse(requestId);
    }

    async publishRequest(requestTypeName: string, message: FlowRequestMessage): Promise<void> {

        console.log(`message: ${JSON.stringify(message)}`);

        const params: PublishInput = {
            Message: JSON.stringify(message),
            TopicArn: this.services.requestPublisher.topicArn
        };

        try {

            console.log(`params: ${JSON.stringify(params)}`);
            
            if (this.services.requestPublisher.client === undefined) throw new Error('this.services.requestPublisher.client === undefined');
            
            const publishResponse = await this.services.requestPublisher.client.publish(params).promise();
            
            console.log(`publishResponse.MessageId: ${publishResponse?.MessageId}`);

        } catch (error) {
            console.error('Error calling this.sns.publish: ' + error.message);
            throw new Error('Error calling this.sns.publish');
        }
    }
}
