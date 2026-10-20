---
section: guides
lang: pt-br
topics: [metadata, privacy, redaction, security]
slug: como-ocultar-informacoes-em-pdf
title: Como ocultar informações em PDF e impedir a cópia do texto
description: "Aprenda a tarjar informações em PDF sem deixar texto copiável sob a faixa preta. Veja o passo a passo, os testes e os limites antes de compartilhar."
h1: Como ocultar informações em PDF e impedir a cópia do texto
author: Mathias
lead: Uma tarja visual pode esconder o texto na tela e ainda deixá-lo dentro do arquivo. O resultado precisa ser verificado na cópia final.
image: /articles/redact-pdf/holy-pdf-redaction-guide-hero.webp
published: 2026-10-19
---

<figure class="article-visual article-visual--hero">
  <img src="/articles/redact-pdf/holy-pdf-redaction-guide-hero.webp" alt="Documento original ao lado de uma cópia com três áreas cobertas por tarjas pretas" width="1600" height="900" loading="eager" decoding="async" />
  <figcaption>Tarjar um PDF deve retirar a informação da cópia compartilhada, não apenas escondê-la na tela.</figcaption>
</figure>

Para ocultar informações em um PDF, abra [Ocultar texto de PDF](/pt-br/ocultar-texto-pdf), escolha uma cópia do documento e desenhe uma área sobre cada dado que precisa sair. O Holy PDF transforma a página marcada em uma imagem e pinta as áreas de preto. Assim, o texto e os objetos daquela página não ficam apenas atrás de um retângulo.

No Brasil, você pode encontrar essa tarefa como **tarjar**, **censurar** ou **ocultar dados** em um PDF. O nome muda, mas o teste decisivo é o mesmo: o dado coberto não pode continuar selecionável, pesquisável ou copiável na versão que será enviada.

## Por que desenhar uma caixa preta não basta

Uma forma preta adicionada em um editor comum pode funcionar como uma camada colocada por cima do texto. O nome, o CPF ou o valor continuam no arquivo. Outra pessoa pode conseguir selecionar o trecho, copiar o conteúdo ou retirar a forma.

O [guia de tarjamento da PortosRio](https://www.portosrio.gov.br/sites/default/files/inline-files/pdf_tools_passo_a_passo_v.2.1.pdf) mostra esse risco com um exemplo simples: o realce preto parece esconder o dado, mas o texto reaparece ao ser copiado para outro programa.

Por isso, não avalie apenas a aparência no editor. Gere uma nova cópia, abra o arquivo baixado e tente recuperar o que deveria ter desaparecido.

## Antes de começar, preserve o original

Trabalhe em uma cópia. O [passo a passo do Ministério da Ciência, Tecnologia e Inovação](https://www.gov.br/mcti/pt-br/acesso-a-informacao/lei-geral-de-protecao-de-dados-pessoais-lgpd/publicacoes-defeso-2026/passo-a-passo-tarjamento.pdf) recomenda manter duas versões porque o texto tarjado é perdido no documento tratado.

Leia todas as páginas e anote o que precisa sair. Dependendo do documento, a lista pode incluir:

- nome, CPF, RG ou endereço;
- telefone e e-mail;
- assinatura ou número de conta;
- valores, protocolos e referências internas;
- informações visíveis em campos, comentários ou anotações.

Separe também uma etapa para conferir título, marcadores e metadados. Eles podem carregar informações que não aparecem no corpo da página.

## Como tarjar o PDF no Holy PDF

1. Abra [Ocultar texto de PDF](/pt-br/ocultar-texto-pdf) e selecione **Escolha um arquivo PDF**.
2. Arraste sobre o primeiro dado que deve desaparecer. A área fica preta.
3. Repita o processo em todas as áreas e páginas necessárias.
4. Use a alça para mover uma área, a cruz para removê-la ou **Limpar esta página** para apagar as marcações da página atual.
5. Selecione **Ocultar as informações** e baixe a nova cópia.

<figure class="article-visual">
  <picture>
    <source media="(max-width: 40rem)" srcset="/articles/redact-pdf/holy-pdf-redaction-ui-pt-br-mobile.webp" width="780" height="1468" />
    <img src="/articles/redact-pdf/holy-pdf-redaction-ui-pt-br.webp" alt="Interface em português do Holy PDF com duas áreas de tarja sobre dados fictícios" width="1320" height="700" loading="lazy" decoding="async" />
  </picture>
  <figcaption>Duas áreas foram desenhadas na interface atual. O documento da captura é sintético e não contém dados de uma pessoa real.</figcaption>
</figure>

O processamento acontece no navegador. O documento não é enviado ao Holy PDF. Para entender o modelo, leia [Seus PDFs ficam no seu dispositivo](/pt-br/blog/seus-pdfs-ficam-no-seu-dispositivo).

## O que a ferramenta remove na implementação atual

Quando uma página recebe pelo menos uma área, o Holy PDF:

- tenta renderizar a página a 200 dpi, limitando o lado maior da imagem a 6.000 pixels;
- pinta de preto as áreas marcadas;
- substitui o conteúdo dessa página por uma imagem JPEG do resultado.

Os testes do motor colocam dados fictícios no texto da página, em um objeto gráfico do PDF (Form XObject), em uma anotação, em um link e em campos de formulário. Depois do processamento, esses dados testados não aparecem nos fluxos brutos nem nos fluxos descompactados do arquivo de saída.

Há uma consequência importante: **todo o texto da página tratada vira imagem**, inclusive o que está fora das tarjas. Ele deixa de ser selecionável e pesquisável. Campos, notas e links presentes nessa página também desaparecem.

Em geral, páginas sem áreas mantêm o texto. Há uma exceção para formulários: se o mesmo campo tiver uma ocorrência na página tratada e outra em uma página não marcada, a ocorrência vinculada também pode ser removida da outra página. Confira o formulário inteiro na cópia final.

## Como verificar a cópia antes de compartilhar

Não envie o arquivo assim que o download terminar. Abra a cópia em outro leitor de PDF e faça estes testes:

- pesquise os nomes, números e palavras que foram tarjados;
- tente selecionar e copiar texto perto de cada faixa preta;
- confira todas as páginas, inclusive as que não receberam marcações;
- abra as propriedades do documento e revise o título e os metadados;
- confira os marcadores;
- confirme que o anexo escolhido é a cópia tratada, não o original.

A [Adobe trata censura e remoção de conteúdo oculto como etapas distintas](https://helpx.adobe.com/pt/acrobat/desktop/protect-documents/redact-pdfs/sanitize.html). O Holy PDF não afirma que a saída está higienizada: a ferramenta de tarja não inspeciona completamente todas as estruturas ou todos os metadados do documento.

## Limites que você precisa conhecer

O Holy PDF recusa PDFs assinados e formulários XFA. A ferramenta também não verifica por completo o título, os marcadores, os metadados, os textos alternativos armazenados na estrutura de marcação (`/Alt` e `/ActualText`), alguns valores padrão de campos (`/DV`) nem as miniaturas das páginas.

Uma página convertida em imagem pode aumentar o tamanho do arquivo. Se a cópia ficar pesada, use [Comprimir PDF](/pt-br/comprimir-pdf) e repita toda a verificação no arquivo comprimido.

[Proteger PDF com senha](/pt-br/proteger-pdf) controla a abertura do arquivo, mas não substitui a remoção dos dados. [Pixelizar PDF](/pt-br/pixelizar-pdf) transforma páginas inteiras em imagens quando o objetivo é deixar todo o texto não selecionável; isso é diferente de marcar apenas algumas informações.

## E se o PDF for uma digitalização?

Você pode desenhar áreas sobre uma página escaneada sem usar OCR. A ferramenta trabalha com a aparência visível da página.

O [OCR PDF](/pt-br/ocr-pdf) serve para adicionar uma camada de texto pesquisável a uma digitalização. Ele não é necessário para aplicar tarjas por área. Se o documento já tiver OCR, a página marcada ainda será transformada em imagem na cópia final.

## Perguntas frequentes

### Como ocultar CPF em um PDF?

Desenhe uma área sobre cada ocorrência do CPF, gere a cópia e pesquise o número no arquivo baixado. Confira também cabeçalhos, rodapés, anexos e metadados.

### Posso tarjar um PDF de graça?

Sim. A ferramenta do Holy PDF é gratuita e não exige cadastro. O processamento acontece no seu dispositivo.

### Uma faixa preta torna o dado irrecuperável?

Não necessariamente. Uma faixa visual pode deixar o texto por baixo. Use um processo que substitua ou remova o conteúdo e teste o arquivo exportado.

### Posso desfazer uma tarja?

Antes de gerar a cópia, remova uma área pela cruz ou use **Limpar esta página**. Depois do download, a página tratada é uma imagem. Guarde o original separadamente caso precise recomeçar.

### A ferramenta remove os metadados do PDF?

Não por completo. Revise o título, o autor, os marcadores e outras propriedades antes de compartilhar um documento sensível.

### Posso tarjar um PDF escaneado?

Sim. Marque as áreas visíveis da digitalização. O OCR não é obrigatório para esse procedimento.

## Fontes oficiais

- [Especificação da ferramenta de tarja do Holy PDF](https://github.com/Snouzy/holy-pdf/blob/main/wiki/specs/2026-10-02-web-redact-design.md)
- [MCTI — Passo a passo para tarjamento de dados pessoais](https://www.gov.br/mcti/pt-br/acesso-a-informacao/lei-geral-de-protecao-de-dados-pessoais-lgpd/publicacoes-defeso-2026/passo-a-passo-tarjamento.pdf)
- [PortosRio — Tarja em dados sensíveis nos documentos PDF](https://www.portosrio.gov.br/sites/default/files/inline-files/pdf_tools_passo_a_passo_v.2.1.pdf)
- [Adobe — Sanitizar PDFs e remover conteúdo oculto](https://helpx.adobe.com/pt/acrobat/desktop/protect-documents/redact-pdfs/sanitize.html)
