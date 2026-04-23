<div align="center">

# EnvPilot

A Windows-first desktop app for runtime setup, multi-version switching, and environment variable governance.

[&#31616;&#20307;&#20013;&#25991;](#zh-cn) | [English](#english)

![License](https://img.shields.io/github/license/xiaohaowen21/envpilot?style=flat-square)
![Release](https://img.shields.io/github/v/release/xiaohaowen21/envpilot?style=flat-square)
![Issues](https://img.shields.io/github/issues/xiaohaowen21/envpilot?style=flat-square)
![Stars](https://img.shields.io/github/stars/xiaohaowen21/envpilot?style=flat-square)
![Forks](https://img.shields.io/github/forks/xiaohaowen21/envpilot?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows%2010%20%2F%2011-4f6f8f?style=flat-square)
![Stack](https://img.shields.io/badge/stack-Electron%20%2B%20React%20%2B%20TypeScript-58677a?style=flat-square)

</div>

---

<a id="zh-cn"></a>

## &#31616;&#20307;&#20013;&#25991;

### &#39033;&#30446;&#31616;&#20171;

EnvPilot &#26159;&#19968;&#20010;&#38754;&#21521; Windows &#30340;&#24320;&#21457;&#29615;&#22659;&#31649;&#29702;&#26700;&#38754;&#24037;&#20855;&#65292;&#32858;&#28966;&#36816;&#34892;&#26102;&#23433;&#35013;&#12289;&#22810;&#29256;&#26412;&#20999;&#25442;&#12289;&#29615;&#22659;&#21464;&#37327;&#27835;&#29702;&#12289;&#31995;&#32479;&#33021;&#21147;&#26816;&#27979;&#19982;&#22238;&#28378;&#12290;

### &#24403;&#21069;&#33021;&#21147;

- &#35782;&#21035;&#26426;&#22120;&#37324;&#24050;&#32463;&#23384;&#22312;&#30340;&#36719;&#20214;&#65292;&#19981;&#35201;&#27714;&#24517;&#39035;&#30001; EnvPilot &#23433;&#35013;&#12290;
- &#25176;&#31649; Java&#12289;Python&#12289;Node.js&#12289;Go&#12289;Rust&#12289;PHP &#30340;&#22810;&#29256;&#26412;&#12290;
- &#25903;&#25345; Java &#21457;&#34892;&#29256;&#36873;&#25321;&#65306;Temurin&#12289;Oracle&#12289;Microsoft&#12290;
- &#26816;&#27979;&#19982;&#25972;&#29702; Path &#20013;&#30340;&#37325;&#22797;&#39033;&#12289;&#31354;&#39033;&#12289;&#22833;&#25928;&#39033;&#21644;&#24322;&#24120;&#39033;&#12290;
- &#26816;&#27979;&#24182;&#31649;&#29702; WSL&#12289;Hyper-V&#12289;Virtual Machine Platform&#12289;Docker Desktop&#12290;

### &#24555;&#36895;&#24320;&#22987;

- &#19979;&#36733;&#26368;&#26032; Windows &#20415;&#25658;&#29256;&#65306;`EnvPilot-0.1.0-x64.exe`

&#26412;&#22320;&#24320;&#21457;&#65306;

```bash
npm install
npm run dev
```

&#26500;&#24314;&#19982;&#25171;&#21253;&#65306;

```bash
npm run lint
npm run build
npm run dist:win
```

### &#27880;&#24847;&#20107;&#39033;

- &#24403;&#21069;&#39033;&#30446;&#20173;&#22788;&#20110;&#26089;&#26399;&#38454;&#27573;&#65292;&#27491;&#24335;&#27979;&#35797;&#21069;&#35831;&#20808;&#38405;&#35835; [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)&#12290;
- &#20462;&#25913;&#31995;&#32479;&#21151;&#33021;&#25110;&#29615;&#22659;&#21464;&#37327;&#21069;&#65292;&#24314;&#35758;&#20808;&#21019;&#24314;&#22791;&#20221;&#12290;

### &#25991;&#26723;

- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)
- [ROADMAP.md](./ROADMAP.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

---

<a id="english"></a>

## English

### Overview

EnvPilot is a Windows-first desktop tool focused on runtime installation, multi-version switching, environment variable governance, system capability checks, and rollback-friendly operations.

### Current Capabilities

- Detect software already present on the machine, even if EnvPilot did not install it
- Manage multiple versions of Java, Python, Node.js, Go, Rust, and PHP
- Support Java vendor selection for Temurin, Oracle, and Microsoft
- Scan and clean duplicate, empty, missing, and suspicious Path entries
- Detect and manage WSL, Hyper-V, Virtual Machine Platform, and Docker Desktop

### Quick Start

- Download the latest Windows portable build: `EnvPilot-0.1.0-x64.exe`

Local development:

```bash
npm install
npm run dev
```

Build and package:

```bash
npm run lint
npm run build
npm run dist:win
```

### Notes

- This project is still in an early stage. Please read [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) before testing on a real machine.
- Create a backup before changing system features or environment variables.

### Documentation

- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)
- [ROADMAP.md](./ROADMAP.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

[MIT](./LICENSE)
