import { expect } from 'chai';
import { IActivityRequestHandler, FlowHandlers } from '../src/FlowHandlers';
import { FlowContext } from '../src/FlowContext';

class ExampleActivityRequest {
    input: number;
}

class ExampleActivityResponse {
    output: number;
}

class ExampleHandler implements IActivityRequestHandler<ExampleActivityRequest, ExampleActivityResponse> {
    async handle(_flowContext: FlowContext, request: ExampleActivityRequest): Promise<ExampleActivityResponse> {
        return { output: request.input };
    }
}

describe('Handlers', () => {

    it('Handlers can send request to handler', async () => {

        const handlers = new FlowHandlers();
        handlers.register(ExampleActivityRequest, ExampleActivityResponse, new ExampleHandler());

        const request = new ExampleActivityRequest();
        request.input = 616;

        const response =
            await handlers.sendRequest(FlowContext.newContext(), ExampleActivityRequest, request) as ExampleActivityResponse;

        expect(response).to.be.not.null;
        expect(response.output).to.be.equal(request.input);
    });
});