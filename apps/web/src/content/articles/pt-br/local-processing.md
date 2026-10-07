---
section: blog
lang: pt-br
topics: [browser-processing, privacy]
slug: seus-pdfs-ficam-no-seu-dispositivo
title: Como o Holy PDF processa PDFs sem upload
description: "PDFium em WebAssembly, Worker e nenhum upload: entenda como o Holy PDF processa PDFs no navegador e como verificar."
h1: Como o Holy PDF processa seus PDFs sem upload
lead: Seus arquivos ficam no dispositivo. Entenda como funciona e como verificar.
published: 2026-10-02
updated: 2026-10-06
---

Muitas ferramentas de PDF online funcionam assim: seu arquivo vai para o servidor, é processado lá e depois o resultado volta. O Holy PDF faz o contrário: o mecanismo vai até o arquivo.

## O mecanismo vai até o arquivo

Quando você solta o primeiro arquivo, o navegador baixa um mecanismo de PDF: o PDFium, projeto de código aberto que também exibe PDFs no Chrome. Ele é compilado em WebAssembly, formato que o navegador executa com rapidez.

O navegador lê o arquivo no seu dispositivo e o entrega ao mecanismo. O processamento acontece em um Worker, uma linha de execução separada, para que a página continue responsiva. O resultado é criado na memória e então oferecido pelo navegador para download. Em nenhum momento o arquivo passa pela rede.

## O que ainda trafega pela rede

O site usa a rede para enviar suas páginas e o mecanismo ao navegador, nunca para receber seus arquivos. O navegador baixa:

- as páginas do site, os estilos e as fontes;
- o mecanismo de PDF, um arquivo de cerca de 4,6 MB antes da compressão, quando você solta o primeiro arquivo;
- se você aceitou a medição de audiência, o script do Google Analytics, que recebe as páginas visualizadas e o nome da ferramenta usada, nunca seu arquivo.

Como em qualquer site, cada solicitação informa ao servidor qual página você pediu. Nenhuma delas contém seus arquivos.

## Como verificar

1. Abra uma ferramenta, por exemplo [Juntar PDF](/pt-br/juntar-pdf).
2. Abra as ferramentas de desenvolvedor do navegador (F12 no Windows ou Option + Command + I no Mac) e selecione a aba Rede. No Safari, primeiro ative os recursos para desenvolvedores em Ajustes, na aba Avançado.
3. Solte um PDF e execute a ferramenta.

Você verá o mecanismo e os arquivos do site chegarem, mas nenhuma solicitação enviará seu documento. Linhas que começam com `blob:` representam arquivos criados dentro do navegador, como miniaturas e o resultado. Elas não trafegam pela rede.

## Por que isso importa

Documento de identidade, holerite, declaração de imposto: esses costumam ser os arquivos que você precisa juntar ou comprimir. Com o Holy PDF, eles ficam com você.
