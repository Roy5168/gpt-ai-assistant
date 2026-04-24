# GPT AI Assistant

<div align="center">

[![license](https://img.shields.io/pypi/l/ansicolortags.svg)](LICENSE) [![Release](https://img.shields.io/github/release/memochou1993/gpt-ai-assistant)](https://GitHub.com/memochou1993/gpt-ai-assistant/releases/)

</div>

GPT AI Assistant is an application that is implemented using the OpenAI API and LINE Messaging API. Through the installation process, you can start chatting with your own AI assistant using the LINE mobile app.

## News

- 2024-07-10: The `4.9` version now support `gpt-4o` OpenAI model. :fire:
- 2023-05-03: The `4.6` version now support `gpt-4` OpenAI model.
- 2023-03-05: The `4.1` version now support the audio message of LINE and  `whisper-1` OpenAI model.
- 2023-03-02: The `4.0` version now support `gpt-3.5-turbo` OpenAI model.

## Documentations

- <a href="https://memochou1993.github.io/gpt-ai-assistant-docs/" target="_blank">中文</a>
- <a href="https://memochou1993.github.io/gpt-ai-assistant-docs/en" target="_blank">English</a>

## Church voting demo (new)

This repo now includes a simple church voting MVP (frontend + backend API) with:

- one-time token based voter login
- anonymous ballot submission
- admin setup for elections/candidates/voters/token generation
- start/end voting and result tally

### Quick start

1. Run server:

```bash
npm install
npm run dev
```

2. Open admin UI:

`http://localhost:3000/church-vote/admin`

3. Open voter UI:

`http://localhost:3000/church-vote`

4. Optional env var (recommended):

`CHURCH_VOTE_ADMIN_KEY=your-secret-key`

## Credits

- [jayer95](https://github.com/jayer95) - Debugging and testing
- [kkdai](https://github.com/kkdai) - Idea of `sum` command
- [Dayu0815](https://github.com/Dayu0815) - Idea of `search` command
- [mics8128](https://github.com/mics8128) - Implementing new features
- [myh-st](https://github.com/myh-st) - Implementing new features
- [Jakevin](https://github.com/Jakevin) - Implementing new features
- [cdcd72](https://github.com/cdcd72) - Implementing new features
- [All other contributors](https://github.com/memochou1993/gpt-ai-assistant/graphs/contributors)

## Contact

If there is any question, please contact me at memochou1993@gmail.com. Thank you.

## Changelog

Detailed changes for each release are documented in the [release notes](https://github.com/memochou1993/gpt-ai-assistant/releases).

## License

[MIT](LICENSE)

- iPadOS 26 Swift Playgrounds Whisper guide: `docs/ios/ipados26-swift-playgrounds-whisper-app.md`
