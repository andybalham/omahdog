import { SNSEvent, APIGatewayEvent, SNSMessage } from 'aws-lambda';
import { HttpResponse } from 'aws-sdk';
import { AsyncResponse } from '../omahdog/FlowHandlers';
import { AsyncRequestMessage, AsyncResponseMessage } from './SNSActivityRequestHandler';

export function getEventContent<TReq>(event: TReq | SNSEvent | APIGatewayEvent): TReq | AsyncRequestMessage | AsyncResponseMessage {

    let content;

    if ('Records' in event) {

        const snsMessage = event.Records[0].Sns;
        content = JSON.parse(snsMessage.Message);

    } else if ('httpMethod' in event) {

        if (event.body === null) throw new Error('APIGatewayEvent.body was null');
        content = JSON.parse(event.body);

    } else {

        content = event;

    }

    return content;
}


export function getReturnValue<TReq, TRes>(event: TReq | SNSEvent | APIGatewayEvent, httpStatusCode: number, response: TRes | AsyncResponse): 
        TRes | AsyncResponse | void | HttpResponse {

    let returnValue: TRes | void | HttpResponse;

    if ('Records' in event) {
        return;
    }
    else if ('httpMethod' in event) {
        const httpResponse = new HttpResponse();
        httpResponse.statusCode = httpStatusCode;
        httpResponse.body = JSON.stringify(response);
        returnValue = httpResponse;
    }
    else {
        return response;
    }

    return returnValue;
}

export function isSNSRequest(snsMessage: SNSMessage): boolean {
    const isSNSRequest = snsMessage.MessageAttributes['MessageType'].Value.endsWith(':Request');
    return isSNSRequest;
}

