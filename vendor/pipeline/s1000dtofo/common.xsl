<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D to XSL-FO: Common Module
     
     Contains common templates for paragraphs, inline elements, 
     references, emphasis, etc.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format"
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <!-- ==================================================================== -->
  <!--                         ATTRIBUTE SETS                                -->
  <!-- ==================================================================== -->
  <!-- Monospace properties for inline verbatim text (like DocBook literal) -->
  <xsl:attribute-set name="monospace.properties">
    <xsl:attribute name="font-family">monospace</xsl:attribute>
  </xsl:attribute-set>
  <!-- Block verbatim properties (for programlisting, screen, etc.) -->
  <xsl:attribute-set name="verbatim">
    <xsl:attribute name="font-family">Courier</xsl:attribute>
    <xsl:attribute name="white-space-treatment">preserve</xsl:attribute>
    <xsl:attribute name="white-space">pre</xsl:attribute>
    <xsl:attribute name="white-space-collapse">false</xsl:attribute>
    <xsl:attribute name="linefeed-treatment">preserve</xsl:attribute>
  </xsl:attribute-set>
  <!--
    centerhead1/2 and sidehead1-5 used to be redefined here as well as in
    s1000dtofo.xsl. Two same-named attribute-sets are merged by the processor,
    and these won for the attributes they both set — so the parameterised
    versions in s1000dtofo.xsl had no effect and heading spacing from Settings
    was silently ignored. The definitions there are now the only ones.
    sidehead0 stays: it is defined nowhere else.
  -->
  <!--
    The heading over a section of a procedure or a requirements list
    ("Support equipment", "Safety conditions"). Space above it rather than
    padding, for the same reason as the numbered sideheads in s1000dtofo.xsl:
    padding is painted wherever the block lands, so one of these carried onto
    a new page arrived with its separation printed above it and sat lower than
    the text on every other page.
  -->
  <xsl:attribute-set name="sidehead0">
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="font-size">14pt</xsl:attribute>
    <xsl:attribute name="space-before.minimum">16pt</xsl:attribute>
    <xsl:attribute name="space-before.optimum">16pt</xsl:attribute>
    <xsl:attribute name="space-before.maximum">16pt</xsl:attribute>
    <xsl:attribute name="space-before.conditionality">discard</xsl:attribute>
  </xsl:attribute-set>
  <xsl:attribute-set name="warning-caution-box">
    <xsl:attribute name="border">1pt solid black</xsl:attribute>
    <xsl:attribute name="padding">6pt</xsl:attribute>
    <xsl:attribute name="background-color">#FFFFCC</xsl:attribute>
  </xsl:attribute-set>
  <xsl:attribute-set name="change.bar.attributes">
    <xsl:attribute name="border-start-color">
      <xsl:value-of select="$change.bar.color"/>
    </xsl:attribute>
    <xsl:attribute name="border-start-style">
      <xsl:value-of select="$change.bar.style"/>
    </xsl:attribute>
    <xsl:attribute name="border-start-width">
      <xsl:value-of select="$change.bar.width"/>
    </xsl:attribute>
  </xsl:attribute-set>
  <!-- ==================================================================== -->
  <!--                         IDENTITY ELEMENTS                             -->
  <!-- ==================================================================== -->
  <xsl:template match="dmCode">
    <xsl:value-of select="@modelIdentCode"/>
    <xsl:text>-</xsl:text>
    <xsl:value-of select="@systemDiffCode"/>
    <xsl:text>-</xsl:text>
    <xsl:value-of select="@systemCode"/>
    <xsl:text>-</xsl:text>
    <xsl:value-of select="@subSystemCode"/>
    <xsl:value-of select="@subSubSystemCode"/>
    <xsl:text>-</xsl:text>
    <xsl:value-of select="@assyCode"/>
    <xsl:text>-</xsl:text>
    <xsl:value-of select="@disassyCode"/>
    <xsl:value-of select="@disassyCodeVariant"/>
    <xsl:text>-</xsl:text>
    <xsl:value-of select="@infoCode"/>
    <xsl:value-of select="@infoCodeVariant"/>
    <xsl:text>-</xsl:text>
    <xsl:value-of select="@itemLocationCode"/>
    <xsl:if test="@learnCode and @learnEventCode">
      <xsl:text>-</xsl:text>
      <xsl:value-of select="@learnCode"/>
      <xsl:value-of select="@learnEventCode"/>
    </xsl:if>
  </xsl:template>
  <xsl:template match="issueDate">
    <xsl:value-of select="@year"/>
    <xsl:text>-</xsl:text>
    <xsl:value-of select="@month"/>
    <xsl:text>-</xsl:text>
    <xsl:value-of select="@day"/>
  </xsl:template>
  <xsl:template match="issueInfo">
    <xsl:value-of select="@issueNumber"/>
    <xsl:if test="@inWork != '00'">
      <xsl:text>-</xsl:text>
      <xsl:value-of select="@inWork"/>
    </xsl:if>
  </xsl:template>
  <xsl:template match="identExtension">
    <xsl:value-of select="@extensionProducer"/>
    <xsl:text>-</xsl:text>
    <xsl:value-of select="@extensionCode"/>
    <xsl:text>-</xsl:text>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                         TITLE TEMPLATES                               -->
  <!-- ==================================================================== -->
  <xsl:template match="dmTitle">
    <xsl:apply-templates select="*"/>
  </xsl:template>
  <xsl:template match="techName">
    <fo:block xsl:use-attribute-sets="centerhead1">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="infoName">
    <fo:block xsl:use-attribute-sets="centerhead2">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="infoNameVariant">
    <xsl:text>, </xsl:text>
    <xsl:apply-templates/>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                       MANUAL PAGE BREAK                               -->
  <!-- ==================================================================== -->
  <!--
    An author-placed <?page-break?> processing instruction forces the content
    that follows onto a new page. A PI is used rather than an element because
    S1000D's schemas have strict content models — a custom <pageBreak/> element
    would fail real XSD validation, while a PI is legal anywhere and simply
    ignored by tools that don't recognise it. This matches the same authoring
    marker the JSS pipeline already supports, so a data module carrying one
    renders identically whichever engine builds it.

    XSLT's built-in rule for processing instructions produces no output, so
    without this template the marker is silently dropped.
  -->
  <!--
    break-AFTER on an empty block here, not break-before.

    Both start the following content on a new page, but break-before puts this
    empty block at the TOP of that page — and whatever follows is then no
    longer the first thing on it. A heading landing there kept the 5mm of
    space above it that a page break is supposed to discard, so an authored
    break left the heading sitting lower than the same heading carried over by
    a natural break. break-after leaves the empty block at the foot of the
    page it breaks from, and the content that follows genuinely starts the
    next one.
  -->
  <xsl:template match="processing-instruction('page-break')">
    <fo:block break-after="page"/>
  </xsl:template>

  <!--
    The same break authored as an ELEMENT. <pageBreak/> is the JSS pipeline's
    spelling and is not valid S1000D, but it turns up in real data modules
    anyway — a natural mistake, since it is the form documented for JSS-type
    projects and nothing rejects it at authoring time. This engine had no
    template for it, so it fell through to the unhandled-element rule: the
    break was dropped and the author's only clue was an "Unhandled element"
    line in the build log.

    Honouring it costs nothing and removes a silent failure. <?page-break?>
    remains the form to prefer, because it survives real XSD validation.
  -->
  <xsl:template match="pageBreak">
    <fo:block break-after="page"/>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                         PARAGRAPH TEMPLATES                           -->
  <!-- ==================================================================== -->
  <xsl:template match="para">
    <fo:block space-before.optimum="10pt" 
        space-before.minimum="8pt" 
        space-before.maximum="12pt">
      <xsl:if test="@id">
        <xsl:call-template name="copy.id"/>
      </xsl:if>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="levelledPara/para|proceduralStep/para">
    <!-- Calculate indentation for JSS format based on nesting level -->
    <xsl:variable name="indent">
      <xsl:choose>
        <xsl:when test="contains($document.format, 'JSS')">
          <xsl:variable name="level" select="count(ancestor::levelledPara)"/>
          <xsl:value-of select="concat($level * 14, 'mm')"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$inner-type-limit"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <fo:block space-before.optimum="10pt" 
        space-before.minimum="8pt" 
        space-before.maximum="12pt" 
        start-indent="{$indent}">
      <xsl:if test="@id">
        <xsl:call-template name="copy.id"/>
      </xsl:if>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="simplePara">
    <fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="notePara">
    <fo:block start-indent="27mm">
      <xsl:if test="preceding-sibling::*">
        <xsl:attribute name="padding-top">
          <xsl:value-of select="$standard-leading"/>
        </xsl:attribute>
      </xsl:if>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!--
    warningAndCautionPara has its real definition in warnings.xsl, id-carrying
    and unindented. A second copy lived here, part of the same sweep noted
    above — and unlike those five, this one was not merely worse, it was
    latently wrong: it set its own start-indent="20mm" (inner-type-limit), but
    every caller reaches this element from inside the notice() template in
    warnings.xsl, whose classic style already indents its content 10mm on
    each side. Had include order ever favoured this copy, a warning or
    caution rendered in the classic style would have indented 30mm rather
    than 10mm, on every warning and caution in the book. It never happened —
    warnings.xsl already won — but it would have been a whole-house
    regression with no error to point at it, from a stylesheet nobody had
    touched.
  -->
  <!-- ==================================================================== -->
  <!--                         INLINE ELEMENTS                               -->
  <!-- ==================================================================== -->
  <!-- Emphasis with em01 (bold) - highest priority -->
  <xsl:template match="emphasis[@emphasisType = 'em01']" priority="2">
    <fo:inline font-weight="bold">
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <!-- Emphasis with no type specified (default to bold) -->
  <xsl:template match="emphasis[not(@emphasisType)]" priority="1">
    <fo:inline font-weight="bold">
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <!-- Emphasis em02 (italic) -->
  <xsl:template match="emphasis[@emphasisType = 'em02']" priority="2">
    <fo:inline font-style="italic">
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <!-- Emphasis em03 (underline) -->
  <xsl:template match="emphasis[@emphasisType = 'em03']" priority="2">
    <fo:inline text-decoration="underline">
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <!-- Emphasis em04 (bold + italic) -->
  <xsl:template match="emphasis[@emphasisType = 'em04']" priority="2">
    <fo:inline font-weight="bold" font-style="italic">
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <!-- Emphasis em05 (bold + underline) -->
  <xsl:template match="emphasis[@emphasisType = 'em05']" priority="2">
    <fo:inline font-weight="bold" text-decoration="underline">
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <!-- Fallback for any other emphasis type -->
  <xsl:template match="emphasis">
    <fo:inline font-weight="bold">
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <xsl:template match="verbatimText[not(@verbatimStyle)]">
    <fo:inline xsl:use-attribute-sets="monospace.properties">
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <!-- Inline verbatim text styles (vs01, vs02, vs12-vs29, etc.) 
       These correspond to DocBook <literal> and are rendered inline with monospace font.
       Based on S1000D spec and s1000dtodb/configurable.xsl mapping:
       vs01: Generic verbatim (default)
       vs02: Filename
       vs12: XML/SGML element name
       vs13: XML/SGML attribute name
       vs14: XML/SGML attribute value
       vs15: XML/SGML entity name
       vs16: XML/SGML processing instruction
       vs21: Program prompt
       vs22: User input
       vs25: Program variable name
       vs26: Program variable value
       vs27: Constant
       vs28: Class name
       vs29: Parameter name
  -->
  <xsl:template match="verbatimText[@verbatimStyle = 'vs01' or
                                    @verbatimStyle = 'vs02' or
                                    @verbatimStyle = 'vs12' or
                                    @verbatimStyle = 'vs13' or
                                    @verbatimStyle = 'vs14' or
                                    @verbatimStyle = 'vs15' or
                                    @verbatimStyle = 'vs16' or
                                    @verbatimStyle = 'vs21' or
                                    @verbatimStyle = 'vs22' or
                                    @verbatimStyle = 'vs25' or
                                    @verbatimStyle = 'vs26' or
                                    @verbatimStyle = 'vs27' or
                                    @verbatimStyle = 'vs28' or
                                    @verbatimStyle = 'vs29']">
    <fo:inline xsl:use-attribute-sets="monospace.properties">
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <!-- Block verbatim text styles (vs11, vs23, vs24) 
       These correspond to DocBook <programlisting> and <screen> and are rendered as blocks.
       Based on S1000D spec and s1000dtodb/configurable.xsl mapping:
       vs11: XML/SGML markup
       vs23: Computer output
       vs24: Program listing
  -->
  <xsl:template match="verbatimText[@verbatimStyle = 'vs11' or
                                    @verbatimStyle = 'vs23' or
                                    @verbatimStyle = 'vs24']">
    <fo:block xsl:use-attribute-sets="verbatim">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="inlineSignificantData">
    <fo:inline>
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    SUBSCRIPT/SUPERSCRIPT                              -->
  <!-- ==================================================================== -->
  <!--
    A raised glyph must not make its own LINE taller than the lines around it.

    baseline-shift="super" is the KEYWORD form, and FOP computes its own shift
    for it — generously, enough that a 75%-size glyph raised by the keyword
    pokes above the ascent of the normal text beside it. FOP always sizes a
    line to its tallest content (line-stacking-strategy="line-height" and
    "font-height" are both accepted and both silently ignored — a known FOP
    limitation, not a setting to reach for here), so that line grew, and grew
    ONLY on the line carrying the superscript: "of more than 1 m²" sat a
    little further down the page than the plain text before and after it. In
    a list item, where the number lives in a column of its own that never
    touches the superscript, that showed as the number floating noticeably
    above the item's own first line.

    Switched to a NUMERIC baseline-shift, which does not carry the keyword's
    extra headroom. 0.3em raises "2" clear of the baseline — a proper
    superscript, not a token nudge — while keeping the glyph's box inside the
    ascent FOP already reserves for ordinary text, so the line does not grow
    and nothing after the superscript drifts. Measured against the rendered
    PDF: the keyword form put the following text 1.21mm low; this puts it
    within a hundredth of a millimetre of level.

    subScript is untouched. A lowered glyph extends into the DESCENT, which
    line-height already has slack for, and it was never observed to move
    anything — the plain text/line above and below a subscript kept its
    position with the keyword form.
  -->
  <xsl:template match="subScript">
    <fo:inline baseline-shift="sub" font-size="75%">
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <xsl:template match="superScript">
    <fo:inline baseline-shift="0.3em" font-size="70%">
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <xsl:template match="acronym">
    <fo:inline>
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <xsl:template match="acronymTerm">
    <fo:inline>
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <xsl:template match="acronymDefinition">
    <fo:inline>
      <xsl:text> (</xsl:text>
      <xsl:apply-templates/>
      <xsl:text>)</xsl:text>
    </fo:inline>
  </xsl:template>
  <xsl:template match="name">
    <fo:inline>
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <xsl:template match="shortName">
    <fo:inline>
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                         NOTES AND ADMONITIONS                         -->
  <!-- ==================================================================== -->
  <!--
    note, warning and caution now live in warnings.xsl, which renders all
    three through one template so $notice.style can choose between the house
    styles.

    They were defined here AND there, at the same import precedence and the
    same priority. That is a conflict, and xsltproc resolves it silently by
    taking whichever include came last — so what a reader saw depended on the
    order of the include list rather than on anything in either file. Keeping
    one definition is the point; this comment marks where the other was.
  -->
  <!-- ==================================================================== -->
  <!--                         REFERENCES                                    -->
  <!-- ==================================================================== -->
  <!--
    pmRef, pmCode, externalPubRef, externalPubTitle and externalPubCode all
    had a second template here, each at the same import precedence and the
    same priority as its real one in refs.xsl — the same conflict internalRef
    had, found by the same sweep that found this one: a test that walks every
    pipeline's include graph and flags any bare element name matched by more
    than one stylesheet with neither a predicate nor an explicit priority to
    break the tie.

    None of these five had rendered visibly wrong — refs.xsl is included
    after this file, so its versions already won every time — but each one
    this file carried was the WORSE of the two: externalPubRef here hardcoded
    color="blue" instead of the house $color-link variable; externalPubTitle
    and externalPubCode carried no styling at all, where refs.xsl's put a
    reference title in italic and a reference code in monospace, as a title
    and a code actually want to look. pmCode was the one honest duplicate,
    byte-for-byte identical either way. Had refs.xsl ever been reordered
    ahead of this file instead of after it, every external and publication-
    module reference in a book would have quietly lost its styling — or, for
    externalPubRef, its link — with nothing to explain why. Deleted rather
    than left as a trap for the day someone touches the include order without
    knowing this file has stand-ins for what refs.xsl already owns.

    externalPubRefIdent stays: nothing else defines it, so it is not part of
    this conflict, and refs.xsl's externalPubRef reaches past it to its
    children directly rather than going through it.
  -->
  <!-- ==================================================================== -->
  <!--                         FOOTNOTES                                     -->
  <!-- ==================================================================== -->
  <!--
    The reference marker (the first fo:inline) sits inline in body text like
    any other superscript, so it carries the same fix and for the same
    reason: the keyword shift grew its line and pushed everything after the
    footnote marker down. The footnote-body marker below is not adjacent to
    other text on its line, so it was never observed to move anything — kept
    numerically anyway so the two markers read at the same size.
  -->
  <xsl:template match="footnote">
    <fo:footnote>
      <fo:inline font-size="70%" baseline-shift="0.3em">
        <xsl:number count="footnote" level="any"/>
      </fo:inline>
      <fo:footnote-body font-size="7pt" text-align="left" start-indent="0pt">
        <fo:block>
          <fo:inline font-size="70%" baseline-shift="0.3em">
            <xsl:number count="footnote" level="any"/>
          </fo:inline>
          <xsl:apply-templates select="para"/>
        </fo:block>
      </fo:footnote-body>
    </fo:footnote>
  </xsl:template>
  <xsl:template match="footnote/para">
    <xsl:apply-templates/>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                         PART NUMBERS                                  -->
  <!-- ==================================================================== -->
  <xsl:template match="identNumber">
    <xsl:if test="manufacturerCode != ''">
      <xsl:if test="$part.no.prefix != 0 and partAndSerialNumber/partNumber">
        <xsl:text>Part No. </xsl:text>
      </xsl:if>
      <xsl:value-of select="manufacturerCode"/>
      <xsl:if test="partAndSerialNumber/partNumber">
        <xsl:text>/</xsl:text>
      </xsl:if>
    </xsl:if>
    <xsl:value-of select="partAndSerialNumber/partNumber"/>
  </xsl:template>
  <xsl:template match="manufacturerCode">
    <fo:inline>
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <xsl:template match="partNumber">
    <fo:inline>
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <xsl:template match="toolRef">
    <xsl:if test="$part.no.prefix != 0">
      <xsl:text>Part No. </xsl:text>
    </xsl:if>
    <xsl:if test="@manufacturerCodeValue">
      <xsl:value-of select="@manufacturerCodeValue"/>
      <xsl:text>/</xsl:text>
    </xsl:if>
    <xsl:value-of select="@toolNumber"/>
  </xsl:template>
  <!--
    A pointer at a numbered item in an illustrated parts figure. Printed as
    "Fig <figureNumber> Item <item>" always; made a real clickable
    cross-reference to that <figure> when one can actually be found —
    @figureNumber is the SOURCE data's own reference code, not this
    pipeline's auto-generated figure number, so it has to be resolved by
    computing every candidate figure's own printed number (the identical
    mode="number" the figure's own caption and the List of Figures use) and
    matching numerically, which also absorbs a zero-padded "01" against a
    printed "1".

    Deliberately scoped to THIS data module only: figureNumber/item may name
    an illustration in a DIFFERENT data module (modelIdentCode and friends
    exist on this element precisely so it can), which this pipeline has no
    way to reach into. A reference that cannot be resolved this way still
    prints the same text, just without the link — never a blank cell, which
    is what happened before this template existed at all.
  -->
  <xsl:template match="catalogSeqNumberRef">
    <xsl:variable name="wanted" select="number(@figureNumber)"/>
    <xsl:variable name="target-id">
      <xsl:for-each select="ancestor::dmodule[1]//figure">
        <xsl:variable name="this-number">
          <xsl:apply-templates select="." mode="number"/>
        </xsl:variable>
        <xsl:if test="number($this-number) = $wanted">
          <xsl:call-template name="unique-id"/>
        </xsl:if>
      </xsl:for-each>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="normalize-space($target-id) != ''">
        <fo:basic-link internal-destination="{normalize-space($target-id)}" color="#0000CC">
          <xsl:text>Fig </xsl:text><xsl:value-of select="@figureNumber"/>
          <xsl:text> Item </xsl:text><xsl:value-of select="@item"/>
        </fo:basic-link>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>Fig </xsl:text><xsl:value-of select="@figureNumber"/>
        <xsl:text> Item </xsl:text><xsl:value-of select="@item"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <!--
    ipd.xsl had a second, plainer partRef — no manufacturer code, no
    $part.no.prefix, just the bare part number. ipd.xsl is included AFTER
    this file, so its copy has been the one actually winning, which made the
    Settings "Part No. " prefix a toggle that worked for supplyRef and
    spareRef right below but silently did nothing for partRef — the
    manufacturer code was dropped from every part reference in an IPD-driven
    book, with nothing to say so. The one thing ipd.xsl's copy had right is
    kept: the monospace face, appropriate for a part number the way it never
    was for plain body text.
  -->
  <xsl:template match="partRef">
    <fo:inline font-family="{$monospace-stack}">
      <xsl:if test="$part.no.prefix != 0">
        <xsl:text>Part No. </xsl:text>
      </xsl:if>
      <xsl:value-of select="@manufacturerCodeValue"/>
      <xsl:text>/</xsl:text>
      <xsl:value-of select="@partNumberValue"/>
    </fo:inline>
  </xsl:template>
  <xsl:template match="supplyRef">
    <xsl:if test="$part.no.prefix != 0">
      <xsl:text>Part No. </xsl:text>
    </xsl:if>
    <xsl:value-of select="@supplyNumber"/>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                         APPLICABILITY                                 -->
  <!-- ==================================================================== -->
  <xsl:template match="displayText">
    <xsl:apply-templates/>
  </xsl:template>
  <xsl:template name="applic.annotation">
    <xsl:if test="applic/displayText/simplePara">
      <fo:block font-style="italic" color="blue">
        <xsl:value-of select="$applic.prefix"/>
        <xsl:apply-templates select="applic/displayText/simplePara"/>
      </fo:block>
    </xsl:if>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    LABELLED PARAGRAPH TEMPLATE                        -->
  <!-- ==================================================================== -->
  <xsl:template name="labelled.para">
    <xsl:param name="label"/>
    <xsl:param name="content"/>
    <fo:block padding-top="{$standard-leading}">
      <fo:list-block provisional-distance-between-starts="{$inner-type-limit}">
        <fo:list-item>
          <fo:list-item-label end-indent="label-end()">
            <fo:block>
              <xsl:copy-of select="$label"/>
            </fo:block>
          </fo:list-item-label>
          <fo:list-item-body start-indent="body-start()">
            <fo:block>
              <xsl:copy-of select="$content"/>
            </fo:block>
          </fo:list-item-body>
        </fo:list-item>
      </fo:list-block>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                         REMARKS                                       -->
  <!-- ==================================================================== -->
  <xsl:template match="remarks">
    <xsl:apply-templates/>
  </xsl:template>
  <xsl:template match="reqQuantity">
    <fo:inline>
      <xsl:apply-templates/>
      <xsl:if test="@unitOfMeasure and @unitOfMeasure != 'EA'">
        <xsl:text> </xsl:text>
        <xsl:value-of select="@unitOfMeasure"/>
      </xsl:if>
    </fo:inline>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                         QUANTITY                                      -->
  <!-- ==================================================================== -->
  <xsl:template match="quantity">
    <fo:inline>
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <xsl:template match="quantityGroup">
    <fo:inline>
      <xsl:apply-templates select="quantityValue"/>
      <xsl:apply-templates select="quantityTolerance"/>
    </fo:inline>
  </xsl:template>
  <xsl:template match="quantityValue">
    <fo:inline>
      <xsl:value-of select="."/>
      <xsl:if test="@quantityUnitOfMeasure">
        <xsl:text> </xsl:text>
        <xsl:value-of select="@quantityUnitOfMeasure"/>
      </xsl:if>
    </fo:inline>
  </xsl:template>
  <xsl:template match="quantityTolerance">
    <fo:inline>
      <xsl:choose>
        <xsl:when test="@quantityToleranceType = 'plus'">+</xsl:when>
        <xsl:when test="@quantityToleranceType = 'minus'">-</xsl:when>
        <xsl:otherwise>± </xsl:otherwise>
      </xsl:choose>
      <xsl:value-of select="."/>
      <xsl:if test="@quantityUnitOfMeasure">
        <xsl:text> </xsl:text>
        <xsl:value-of select="@quantityUnitOfMeasure"/>
      </xsl:if>
    </fo:inline>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                         CHANGE TRACKING                               -->
  <!-- ==================================================================== -->
  <xsl:template match="changeInline">
    <xsl:choose>
      <xsl:when test="@changeMark = '1' or @changeMark = 'true'">
        <fo:inline>
          <xsl:if test="@changeType = 'add'">
            <xsl:attribute name="background-color">#ddffdd</xsl:attribute>
          </xsl:if>
          <xsl:if test="@changeType = 'modify'">
            <xsl:attribute name="background-color">#ffffcc</xsl:attribute>
          </xsl:if>
          <xsl:if test="@changeType = 'delete'">
            <xsl:attribute name="text-decoration">line-through</xsl:attribute>
            <xsl:attribute name="color">red</xsl:attribute>
          </xsl:if>
          <xsl:apply-templates/>
        </fo:inline>
      </xsl:when>
      <xsl:otherwise>
        <xsl:apply-templates/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                         FUNCTIONAL ITEMS                              -->
  <!-- ==================================================================== -->
  <!--
    accessPointRef and zoneRef used to be matched here too, alongside
    functionalItemRef/controlIndicatorRef — the same match= list, one
    template. But proced.xsl ALSO matches accessPointRef and zoneRef, each on
    its own, each printing a word in front of the number ("Access Point 12",
    "Zone 12") rather than the bare number this template prints. proced.xsl
    is included after this file, so its versions already won — a reader
    following an access-point or zone reference has always seen the word —
    but the number-only version sat here as a second, equal-priority
    definition all the same. Trimmed to the two elements that are only ever
    matched here.
  -->
  <xsl:template match="functionalItemRef|controlIndicatorRef">
    <fo:inline font-family="{$monospace-stack}">
      <xsl:choose>
        <xsl:when test="@functionalItemNumber">
          <xsl:value-of select="@functionalItemNumber"/>
        </xsl:when>
        <xsl:when test="@controlIndicatorNumber">
          <xsl:value-of select="@controlIndicatorNumber"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates/>
        </xsl:otherwise>
      </xsl:choose>
    </fo:inline>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    JSS FORMAT HELPER TEMPLATES                        -->
  <!-- ==================================================================== -->
  <!-- Convert number to JSS alphanumeric format (excluding i, o, x, v) -->
  <xsl:template name="jss.alpha.format">
    <xsl:param name="num"/>
    <xsl:param name="format">lower</xsl:param>
    <xsl:variable name="alphabet">
      <xsl:choose>
        <xsl:when test="$format = 'upper'">
          <xsl:value-of select="$jss.alpha.upper"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$jss.alpha.lower"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="alpha.len" select="string-length($alphabet)"/>
    <xsl:choose>
      <!-- Single letter (1-22) -->
      <xsl:when test="$num &lt;= $alpha.len">
        <xsl:value-of select="substring($alphabet, $num, 1)"/>
      </xsl:when>
      <!-- Two letters (23+) -->
      <xsl:otherwise>
        <xsl:variable name="first" select="floor(($num - 1) div $alpha.len)"/>
        <xsl:variable name="second" select="(($num - 1) mod $alpha.len) + 1"/>
        <xsl:value-of select="substring($alphabet, $first, 1)"/>
        <xsl:value-of select="substring($alphabet, $second, 1)"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
</xsl:stylesheet>