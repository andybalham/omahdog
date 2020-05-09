import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AsyncRequestMessage, AsyncResponseMessage } from './omahdog-aws/AsyncExchange';
import { FlowContext } from './omahdog/FlowContext';
import { requestRouter, handlerFactory } from './requestConfiguration';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from './exchanges/AddThreeNumbersExchange';
import { FlowRequestHandler } from './omahdog/FlowRequestHandler';
import { FlowBuilder } from './omahdog/FlowBuilder';
import { FlowDefinition } from './omahdog/FlowDefinition';

// TODO 01May20: Package this up as a class for easy use in a host application

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    try {
        
        console.log(`event: ${JSON.stringify(event)}`);

        let request: AddThreeNumbersRequest;

        if (event.httpMethod === 'POST') {

            if (event.body === null) throw new Error('event.body === null');

            request = JSON.parse(event.body);

        } else {

            request = {
                a: parseInt(event.queryStringParameters?.a ?? '0'),
                b: parseInt(event.queryStringParameters?.b ?? '0'),
                c: parseInt(event.queryStringParameters?.c ?? '0'),
            };

        }
    
        const flowContext = FlowContext.newContext();
        // TODO 08May20: Would we want a different routing for the controller?
        flowContext.requestRouter = requestRouter;
        flowContext.handlerFactory = handlerFactory;
        
        const response = await flowContext.sendRequest(AddThreeNumbersRequest, request);

        // TODO 08May20: Handle async and error responses

        return {
            statusCode: 200,
            body: JSON.stringify(response)
        };

    } catch (error) {
        console.error(`error.message: ${error.message}`);        
        console.error(`error.stack: ${error.stack}`);        

        return {
            statusCode: 500,
            body: `error.stack: ${error.stack}`
        };
    }
};

// TODO 09May20: Remove the code below

class RequestResponseState {
    request: AddThreeNumbersRequest;
    response: AddThreeNumbersResponse;
}

class RequestResponseFlowHandler extends FlowRequestHandler<AddThreeNumbersRequest, AddThreeNumbersResponse, RequestResponseState> {

    constructor () {
        super(RequestResponseFlowHandler, AddThreeNumbersResponse, RequestResponseState);
    }

    buildFlow(flowBuilder: FlowBuilder<AddThreeNumbersRequest, AddThreeNumbersResponse, RequestResponseState>): 
        FlowDefinition<AddThreeNumbersRequest, AddThreeNumbersResponse, RequestResponseState> {

        return flowBuilder
            .initialise((req, state) => {
                state.request = req;
            })
            .perform('Activity', AddThreeNumbersRequest, AddThreeNumbersResponse, 
                (req, state) => { req = state.request; }, // TODO 08May20: How to copy all properties?
                (res, state) => { state.response = res; })
            .finalise((res, state) => {
                res = state.response;
            });
    }
}