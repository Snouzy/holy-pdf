---
section: guides
lang: pt-br
topics: [password, privacy, protect, security]
slug: como-colocar-senha-em-pdf
title: Como colocar senha em PDF no computador e no celular
description: "Veja como colocar senha em um PDF no navegador, no computador ou no celular, o que a senha protege de verdade e o que fazer se você a esquecer."
h1: Como colocar senha em um PDF
author: Mathias
lead: "Abra Proteger PDF, escolha o arquivo, digite a senha duas vezes e baixe a cópia protegida. A senha controla a abertura do arquivo: depois de aberto, ele ainda pode ser impresso ou copiado, conforme o leitor usado."
image: /articles/password-protect-pdf/holy-pdf-senha-hero.webp
published: 2026-11-02
---

<figure class="article-visual article-visual--hero">
  <img src="/articles/password-protect-pdf/holy-pdf-senha-hero.webp" alt="Folhas impressas sobre uma mesa de madeira, com um pequeno cadeado de latão apoiado em cima" width="1600" height="900" loading="eager" decoding="async" />
  <figcaption>Uma senha de abertura funciona como um cadeado na porta: quem tem a chave entra e vê tudo.</figcaption>
</figure>

Para colocar senha em PDF, abra [Proteger PDF](/pt-br/proteger-pdf), escolha o arquivo, digite a senha duas vezes e selecione **Proteger o PDF**. Você baixa uma cópia que só abre com essa senha. O arquivo original continua como estava.

Um aviso antes de começar: essa senha **controla a abertura** do PDF, e só isso. Quem a digita vê o documento inteiro e, dependendo do leitor que usar, pode imprimir, copiar o texto ou salvar uma cópia. Se o que você quer é impedir a cópia ou a edição, a senha não resolve, e a [seção de perguntas](#perguntas-frequentes) indica as ferramentas certas.

**[Abrir Proteger PDF](/pt-br/proteger-pdf)** · grátis, sem cadastro, direto no navegador.

## Como colocar senha em um PDF, passo a passo

1. Entre em [Proteger PDF](/pt-br/proteger-pdf) e selecione **Escolha arquivos PDF**, ou arraste o arquivo para a área indicada. Uma miniatura da primeira página aparece com o nome, o número de páginas e o tamanho do arquivo.
2. No painel **Senha**, digite a senha e repita em **Confirmar a senha**. O botão **Proteger o PDF** fica cinza até as duas senhas serem iguais; se forem diferentes, aparece abaixo do campo a mensagem "As duas senhas não correspondem."
3. Selecione **Proteger o PDF**. A criptografia acontece no seu navegador, no seu dispositivo. O arquivo e a senha não são enviados a um servidor nem guardados pelo Holy PDF.
4. Selecione **Baixar o PDF**. A cópia recebe o sufixo `-protegido`: um arquivo `holerite-outubro.pdf` vira `holerite-outubro-protegido.pdf`.

<figure class="article-visual">
  <picture>
    <source media="(max-width: 40rem)" srcset="/articles/password-protect-pdf/holy-pdf-senha-ui-pt-br-mobile.webp" width="780" height="1000" />
    <img src="/articles/password-protect-pdf/holy-pdf-senha-ui-pt-br.webp" alt="Interface em português do Holy PDF com um demonstrativo de pagamento fictício carregado, os dois campos de senha preenchidos e o botão Proteger o PDF ativo" width="1320" height="700" loading="lazy" decoding="async" />
  </picture>
  <figcaption>Os dois campos preenchidos com a mesma senha liberam o botão. O documento da captura é fictício.</figcaption>
</figure>

Na mesma tela, o botão **Ver** abre a cópia protegida na própria página, com a senha que você acabou de digitar. É um primeiro sinal de que a cópia foi criada; a conferência de verdade vem [mais abaixo](#como-confirmar-que-a-proteção-funcionou).

Você pode soltar vários PDFs de uma vez: todos recebem a mesma senha, e o resultado chega em um arquivo `.zip` no computador.

<figure class="article-visual">
  <img src="/articles/password-protect-pdf/holy-pdf-senha-resultado-pt-br.webp" alt="Tela de resultado do Holy PDF com a mensagem Seu PDF está protegido, o nome holerite-outubro-protegido.pdf e os botões Baixar o PDF e Ver" width="1320" height="700" loading="lazy" decoding="async" />
  <figcaption>A cópia protegida mantém o nome original e ganha o sufixo "-protegido".</figcaption>
</figure>

Precisa proteger outro PDF? Na mesma tela de [Proteger PDF](/pt-br/proteger-pdf), selecione **Proteger outro PDF**.

## No celular: o que muda

No celular, a ferramenta é a mesma, aberta no navegador. O que muda é a organização da tela: a fala do frei e a miniatura do arquivo vêm primeiro, os campos **Senha** e **Confirmar a senha** ficam logo abaixo, e o botão **Proteger o PDF** fica preso à parte de baixo da tela enquanto você digita.

Depois do processamento, **Baixar o PDF** faz o download pelo navegador do celular, e **Ver** mostra a cópia protegida sem sair da página.

Com vários arquivos ao mesmo tempo, o botão vira **Salvar N PDFs** (N é a quantidade de arquivos) quando o navegador do celular consegue compartilhar arquivos. Ele abre o menu de compartilhamento do aparelho, e você escolhe onde guardar os PDFs. Se esse menu não estiver disponível, os arquivos chegam em um arquivo `.zip`, como no computador.

## O que a senha protege e o que ela não protege

Proteger um PDF com senha controla a **abertura**: sem ela, o leitor de PDF pede a senha antes de mostrar qualquer página. A cópia usa a criptografia padrão do formato PDF, AES de 256 bits.

A senha não protege contra quem já a conhece. O Holy PDF cria a cópia com todas as permissões liberadas: depois de abrir o arquivo, a pessoa pode imprimir, copiar texto, editar ou salvar uma versão nova. Essa pessoa também pode gerar uma cópia sem senha, por exemplo com [Desbloquear PDF](/pt-br/desbloquear-pdf).

Na prática, isso significa que:

- a senha serve para o arquivo não ser lido por quem **não** deveria recebê-lo: um e-mail encaminhado por engano, um anexo mandado para o grupo errado;
- a senha não controla o que o destinatário faz **depois** de abrir, não esconde o conteúdo de quem já o viu e não impede uma captura de tela.

Para deixar um PDF difícil de editar ou de copiar, as ferramentas são outras. [Achatar PDF](/pt-br/achatar-pdf) fixa campos de formulário e anotações no conteúdo da página. [Pixelizar PDF](/pt-br/pixelizar-pdf) transforma cada página em imagem: o texto deixa de ser selecionável e pesquisável.

## Como escolher e enviar a senha

A senha pode ter letras, números, símbolos, espaços e acentos: o Holy PDF aceita todos eles. Prefira algo que o destinatário consiga digitar sem erro no celular e evite dados fáceis de adivinhar, como o nome da pessoa ou a data do documento.

Envie a senha por um canal diferente do arquivo. Se o PDF vai por e-mail, mande a senha por mensagem ou passe por telefone. Quem conseguir ler a caixa de entrada não deve encontrar as duas coisas no mesmo lugar.

Se vários documentos vão para a mesma pessoa, uma única senha para todos facilita a vida dela. Se vão para pessoas diferentes, proteja cada arquivo separadamente, com senhas diferentes.

## E se eu esquecer a senha?

O Holy PDF não guarda a senha e não tem como recuperá-la: ela só existe no seu navegador enquanto a página está aberta. Por isso, **mantenha o arquivo original** até ter certeza de que a cópia protegida abre e de que a senha está anotada em um lugar seguro.

Se você ainda tem o original, basta criar uma nova cópia protegida. Se só tem a cópia e lembra a senha, [Desbloquear PDF](/pt-br/desbloquear-pdf) gera uma versão que abre sem ela, e você pode proteger de novo com outra senha. Se só tem a cópia e não lembra a senha, nenhuma ferramenta do Holy PDF vai adivinhá-la.

## Como confirmar que a proteção funcionou

Não envie o arquivo assim que o download terminar. Faça três conferências rápidas:

1. Abra a cópia baixada em outro programa, como o leitor de PDF do seu navegador ou do seu computador. Ele deve pedir a senha antes de mostrar qualquer página.
2. Digite uma senha errada de propósito. O arquivo não deve abrir.
3. Digite a senha certa e confira se todas as páginas estão lá, inclusive a última.

Os testes automáticos do Holy PDF fazem essas conferências com os leitores de PDF embutidos no Chrome (PDFium) e no Firefox (pdf.js): a cópia abre com a senha certa, e só com ela. Mesmo assim, conferir no seu próprio leitor leva um minuto e evita enviar um arquivo que não ficou protegido.

Por último, confira o nome do anexo antes de enviar: o certo é o arquivo com `-protegido`, não o original.

## Perguntas frequentes

### Como deixar o PDF somente para leitura?

A senha de abertura não faz isso: quem abre o arquivo pode editá-lo e copiá-lo conforme o leitor usado. Para fixar formulários e anotações, use [Achatar PDF](/pt-br/achatar-pdf). Para que o texto não possa ser selecionado nem copiado diretamente, use [Pixelizar PDF](/pt-br/pixelizar-pdf), que transforma as páginas em imagens; um programa de OCR ainda consegue lê-las.

### Como desbloquear um PDF protegido se eu sei a senha?

Abra [Desbloquear PDF](/pt-br/desbloquear-pdf), escolha o arquivo e digite a senha quando ela for pedida. Você baixa uma cópia que abre sem senha; o arquivo original continua protegido. A ferramenta não tenta descobrir uma senha que você não conhece.

### Meu arquivo ou minha senha são enviados para um servidor?

Não. A criptografia acontece no navegador, no seu dispositivo. O site carrega o código da ferramenta, mas o conteúdo do PDF e a senha não são enviados nem armazenados pelo Holy PDF.

### Posso colocar a mesma senha em vários PDFs?

Sim. Solte todos os arquivos de uma vez: cada um recebe a mesma senha. No computador, eles chegam em um arquivo `.zip`; no celular, o menu de compartilhamento do aparelho se abre quando o navegador permite; caso contrário, você também recebe um arquivo `.zip`.

### Por que um PDF assinado é recusado?

Um PDF com assinatura digital, feita com certificado digital, teria a assinatura invalidada se fosse reescrito. Por isso, o Holy PDF não cria a cópia e mostra a mensagem "Este PDF já contém uma assinatura digital e não pode ser alterado aqui." Uma assinatura desenhada com [Assinar PDF](/pt-br/assinar-pdf) é uma imagem na página, não uma assinatura digital, e não impede a proteção.

## Fontes

- [Especificação da ferramenta Proteger e Desbloquear do Holy PDF](https://github.com/Snouzy/holy-pdf/blob/main/wiki/specs/2026-10-02-web-protect-unlock-design.md)
