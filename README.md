# RUSH TIMER

Cronômetro de treino intervalado para rounds independentes de exercício (RUSH) e descanso (BREAK). Funciona offline depois do primeiro carregamento e pode ser instalado como PWA.

## Comandos

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

- `npm run dev` sobe o app em desenvolvimento.
- `npm test` valida a máquina de estados, os cálculos de duração e a persistência local.
- `npm run build` gera a versão de produção em `dist/`, com service worker e manifesto.
- `npm run preview` serve essa build. Use esse endereço, em HTTPS ou localhost, para testar a instalação.

Os ícones podem ser gerados de novo com `npm run icons`.

## Instalação

No Android e no desktop, o app mostra o botão **Instalar** quando o navegador dispara o evento de instalação. No iPhone e no iPad, use o Safari: Compartilhar → Adicionar à Tela de Início. As instruções ficam ocultas quando o app já está aberto em modo standalone.

A hospedagem pode ser a Vercel ou qualquer servidor estático com HTTPS. O `vercel.json` evita cache antigo do service worker e do manifesto.
