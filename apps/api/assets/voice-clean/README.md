# voice-clean

`std.rnnn` — the RNNoise model read by ffmpeg's `arnndn` filter in the clean step of a ダチ voice message
(`apps/api/src/voice/voice-mix.ts`, `CLEAN_MODEL`; the client's "sample 3", 2026-11-27).

- **Source**: <https://raw.githubusercontent.com/richardpl/arnndn-models/master/std.rnnn> (fetched 2026-11-27),
  302903 bytes, first line `rnnoise-nu model file version 1`,
  sha256 `6b8943dc4a9b6b24425873992a44f29c0577503276456af46a8854774faeb294`.
- **What it is**: that repository's README says: "std.rnnn is one originally bundled with Xiph RNNoise
  implementation" — the weights of <https://github.com/xiph/rnnoise> (`rnn_data.c`) in the text format the filter reads.
- **Licence**: the arnndn-models repository itself has no licence file. RNNoise, where these weights come from, is
  under the BSD 3-Clause licence below, which allows redistribution with this notice kept.

```
Copyright (c) 2017, Mozilla
Copyright (c) 2007-2017, Jean-Marc Valin
Copyright (c) 2005-2017, Xiph.Org Foundation
Copyright (c) 2003-2004, Mark Borgerding

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:

- Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.

- Redistributions in binary form must reproduce the above copyright
notice, this list of conditions and the following disclaimer in the
documentation and/or other materials provided with the distribution.

- Neither the name of the Xiph.Org Foundation nor the names of its
contributors may be used to endorse or promote products derived from
this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE FOUNDATION
OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
