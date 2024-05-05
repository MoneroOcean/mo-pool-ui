// npm i -D critical@latest

"use strict";

import {generate} from 'critical';

generate({
    inline: true,
    base: 'build',
    src: './index-raw.html',
    target: './index.html',
    width: 1024,
    height: 768
});