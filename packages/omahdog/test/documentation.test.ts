import fs = require('fs');
import { DipCreationHandler } from './stateMachine.test';
import { SumFlowHandler } from './addFlow.test';
import { SwitchTestFlowHandler } from './switchFlow.test';

describe('Documentation', () => {

    it('can output documentation', () => {

        const fileName = 'test\\documentation.md';

        if (fs.existsSync(fileName)) {
            fs.unlinkSync(fileName);
        }

        new SumFlowHandler().appendDiagram(fileName);
        new SwitchTestFlowHandler().appendDiagram(fileName);
        new DipCreationHandler().appendDiagram(fileName);
    });
});
