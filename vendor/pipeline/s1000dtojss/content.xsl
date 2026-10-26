<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D -> JSS: common content mapping

     Maps the element vocabulary shared by every S1000D schema onto the JSS
     book vocabulary consumed by jsstofo/.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">

    <!-- ==================================================================== -->
    <!--                            PARAGRAPHS                                 -->
    <!-- ==================================================================== -->
    <xsl:template match="para | simplePara | commonInfoDescrPara">
        <para><xsl:copy-of select="@id"/><xsl:apply-templates/></para>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                         LEVELLED PARAGRAPHS                           -->
    <!-- ==================================================================== -->
    <!-- A titled levelledPara is a numbered section; an untitled one is just
         a run of content at the current level. -->
    <xsl:template match="levelledPara[title]">
        <section>
            <xsl:copy-of select="@id"/>
            <title><xsl:value-of select="normalize-space(title)"/></title>
            <xsl:apply-templates select="*[not(self::title)]"/>
        </section>
    </xsl:template>

    <xsl:template match="levelledPara[not(title)]">
        <xsl:apply-templates/>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                          INLINE FORMATTING                            -->
    <!-- ==================================================================== -->
    <!-- em01 bold, em02 italic, em03 underline (S1000D emphasis types) -->
    <xsl:template match="emphasis[@emphasisType='em02']">
        <i><xsl:apply-templates/></i>
    </xsl:template>
    <xsl:template match="emphasis[@emphasisType='em03']">
        <u><xsl:apply-templates/></u>
    </xsl:template>
    <xsl:template match="emphasis">
        <b><xsl:apply-templates/></b>
    </xsl:template>

    <xsl:template match="subScript"><sub><xsl:apply-templates/></sub></xsl:template>
    <xsl:template match="superScript"><sup><xsl:apply-templates/></sup></xsl:template>

    <xsl:template match="verbatimText | inlineSignificantData | name | shortName">
        <xsl:apply-templates/>
    </xsl:template>

    <!-- Acronyms print as the term; the expansion is collected into the
         List of Abbreviations. -->
    <xsl:template match="acronym">
        <xsl:value-of select="acronymTerm"/>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                               LISTS                                   -->
    <!-- ==================================================================== -->
    <!-- randomList and sequentialList both become a JSS list; jsstofo applies
         the (a)/(i) lettering by depth when the list carries no @type of its
         own. The attention*/caution*/warning* list variants (used inside
         notes, cautions and warnings) have the identical shape — list /
         listItem / listItemPara — so they map the same way. Left unhandled
         they would collapse into one run-on paragraph.

         "Random" is the S1000D word for an UNORDERED (bulleted) list, as
         opposed to sequentialList's numbered/lettered one — that distinction
         used to be thrown away entirely at this mapping, both becoming the
         same bare <list> with no @type, which left jsstofo's own depth-based
         guess to decide the marker: alpha at the top level, roman one level
         down, bullet only from the third level in. A random list at the top
         level — the common case — rendered "(a) (b) (c)" instead of bullets,
         because nothing here ever told jsstofo it was looking at one.
         Stamping @type="bullet" on every Random variant makes the marker
         follow what the author actually wrote, at any depth, rather than an
         accident of nesting. -->
    <xsl:template match="randomList | sequentialList
                       | attentionRandomList | attentionSequentialList
                       | cautionRandomList | cautionSequentialList
                       | warningRandomList | warningSequentialList
                       | noteRandomList | noteSequentialList">
        <xsl:if test="title">
            <para indent="none"><b><xsl:value-of select="normalize-space(title)"/></b></para>
        </xsl:if>
        <list>
            <xsl:if test="self::randomList or self::attentionRandomList
                       or self::cautionRandomList or self::warningRandomList or self::noteRandomList">
                <xsl:attribute name="type">bullet</xsl:attribute>
            </xsl:if>
            <xsl:apply-templates select="listItem
                | attentionRandomListItem | attentionSequentialListItem
                | cautionRandomListItem | cautionSequentialListItem
                | warningRandomListItem | warningSequentialListItem
                | noteRandomListItem | noteSequentialListItem"/>
        </list>
    </xsl:template>

    <xsl:template match="listItem
                       | attentionRandomListItem | attentionSequentialListItem
                       | cautionRandomListItem | cautionSequentialListItem
                       | warningRandomListItem | warningSequentialListItem
                       | noteRandomListItem | noteSequentialListItem">
        <item><xsl:apply-templates/></item>
    </xsl:template>

    <!-- A paragraph directly inside a list item must not re-open a block,
         or the item label and its text end up on separate lines. Covers the
         plain para and the attention/caution/warning/note item-para variants. -->
    <xsl:template match="listItem/para
                       | attentionListItemPara | cautionListItemPara
                       | warningListItemPara | noteListItemPara">
        <xsl:apply-templates/>
    </xsl:template>

    <xsl:template match="definitionList">
        <xsl:if test="title">
            <para indent="none"><b><xsl:value-of select="normalize-space(title)"/></b></para>
        </xsl:if>
        <deflist>
            <xsl:apply-templates select="definitionListItem"/>
        </deflist>
    </xsl:template>

    <xsl:template match="definitionListItem">
        <defitem>
            <term><xsl:apply-templates select="listItemTerm/node()"/></term>
            <def><xsl:apply-templates select="listItemDefinition/node()"/></def>
        </defitem>
    </xsl:template>

    <xsl:template match="listItemDefinition/para">
        <xsl:apply-templates/>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                              FIGURES                                  -->
    <!-- ==================================================================== -->
    <xsl:template match="figure">
        <figure>
            <xsl:copy-of select="@id"/>
            <xsl:if test="title">
                <title><xsl:value-of select="normalize-space(title)"/></title>
            </xsl:if>
            <xsl:apply-templates select="graphic | processing-instruction('page-break')"/>
            <xsl:apply-templates select="legend"/>
        </figure>
    </xsl:template>

    <!-- A figure legend is the callout KEY: number -> part name, matching the
         item balloons on the illustration. Map each definitionListItem to a
         <keyitem num="..."> so jsstofo can lay them out as a compact multi-
         column key. Any non-list legend content (free text) passes through as
         paragraphs so nothing is lost. -->
    <xsl:template match="legend">
        <legend>
            <xsl:for-each select="definitionList/definitionListItem">
                <keyitem num="{normalize-space(listItemTerm)}">
                    <xsl:value-of select="normalize-space(listItemDefinition)"/>
                </keyitem>
            </xsl:for-each>
            <xsl:apply-templates select="*[not(self::definitionList)]
                                         | processing-instruction('page-break')"/>
        </legend>
    </xsl:template>

    <!--
      S1000D points at graphics by ICN through @infoEntityIdent. Where the data
      module declares the matching unparsed entity (the CSDB style, with a
      DOCTYPE listing each ICN and its file), that declaration is authoritative
      and already resolves to the file next to the data module. Only when no
      such entity exists does the ICN fall back to being mapped onto
      <graphics.dir>/<ICN><graphics.ext>.
    -->
    <xsl:template match="graphic">
        <!-- Trimmed: an ICN written with stray whitespace (infoEntityIdent=" ICN-...")
             would not match the declared entity, and the space would end up in
             the file path. -->
        <xsl:variable name="icn" select="normalize-space(@infoEntityIdent)"/>
        <xsl:variable name="entity-uri" select="unparsed-entity-uri($icn)"/>
        <graphic>
            <xsl:attribute name="src">
                <xsl:choose>
                    <xsl:when test="$entity-uri != ''">
                        <xsl:value-of select="$entity-uri"/>
                    </xsl:when>
                    <xsl:otherwise>
                        <xsl:value-of select="concat($graphics.dir, $icn, $graphics.ext)"/>
                    </xsl:otherwise>
                </xsl:choose>
            </xsl:attribute>
            <!--
              Sizing. reproductionWidth/reproductionHeight are the S1000D
              attributes; plain width/height are accepted as aliases so either
              spelling works. Setting a height is the lever for a graphic that
              is taller than the page is deep, which would otherwise run past
              the bottom when scaled to the full text width.
            -->
            <xsl:variable name="w" select="normalize-space(concat(@reproductionWidth, @width))"/>
            <xsl:variable name="h" select="normalize-space(concat(@reproductionHeight, @height))"/>
            <xsl:if test="$w != ''">
                <xsl:attribute name="width">
                    <xsl:call-template name="reproduction-length">
                        <xsl:with-param name="v" select="$w"/>
                    </xsl:call-template>
                </xsl:attribute>
            </xsl:if>
            <xsl:if test="$h != ''">
                <xsl:attribute name="height">
                    <xsl:call-template name="reproduction-length">
                        <xsl:with-param name="v" select="$h"/>
                    </xsl:call-template>
                </xsl:attribute>
            </xsl:if>
        </graphic>
    </xsl:template>

    <!--
      <symbol> is S1000D's small-graphic reference — the same ICN mechanism as
      <graphic>, used for icons and inline artwork rather than full figures.
      Without this template it fell through to the match="*" catch-all, which
      descends into children; <symbol> is empty, so every one of them was
      dropped from the book without a warning.

      It maps onto a jssbook <graphic>, which means it renders as a block (the
      JSS book format has no inline-image element) and picks up intrinsic-w/-h
      from the server's annotation pass like any other graphic.

      Sizing mirrors the direct S1000D -> FO pipeline so both engines agree:
      an explicit reproduction size wins; @reproductionScale is bounded to
      60mm so a "scaled" icon cannot grow to the full page cap; and a bare
      <symbol/> is treated as a text-sized icon (16pt = 5.64mm) rather than
      being blown up to its natural size.
    -->
    <xsl:template match="symbol">
        <xsl:variable name="icn" select="normalize-space(@infoEntityIdent)"/>
        <xsl:variable name="entity-uri" select="unparsed-entity-uri($icn)"/>
        <graphic>
            <xsl:attribute name="src">
                <xsl:choose>
                    <xsl:when test="$entity-uri != ''">
                        <xsl:value-of select="$entity-uri"/>
                    </xsl:when>
                    <xsl:otherwise>
                        <xsl:value-of select="concat($graphics.dir, $icn, $graphics.ext)"/>
                    </xsl:otherwise>
                </xsl:choose>
            </xsl:attribute>
            <xsl:variable name="w" select="normalize-space(concat(@reproductionWidth, @width))"/>
            <xsl:variable name="h" select="normalize-space(concat(@reproductionHeight, @height))"/>
            <xsl:choose>
                <xsl:when test="$w != '' or $h != ''">
                    <xsl:if test="$w != ''">
                        <xsl:attribute name="width">
                            <xsl:call-template name="reproduction-length">
                                <xsl:with-param name="v" select="$w"/>
                            </xsl:call-template>
                        </xsl:attribute>
                    </xsl:if>
                    <xsl:if test="$h != ''">
                        <xsl:attribute name="height">
                            <xsl:call-template name="reproduction-length">
                                <xsl:with-param name="v" select="$h"/>
                            </xsl:call-template>
                        </xsl:attribute>
                    </xsl:if>
                </xsl:when>
                <!-- An icon: bound the HEIGHT, not the width. Bounding width
                     at 60mm made a wide symbol 60mm across and correspondingly
                     tall, so a hazard icon filled most of a table row. -->
                <xsl:when test="@reproductionScale">
                    <xsl:attribute name="height"><xsl:value-of select="$symbol.size"/></xsl:attribute>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:attribute name="height">5.64mm</xsl:attribute>
                </xsl:otherwise>
            </xsl:choose>
        </graphic>
    </xsl:template>

    <!--
      S1000D reproduction sizes carry a unit: the schema pattern is
      \d+(\.\d+)?\s*(cm|in|mm|pc|pt), so "80mm" and "80 mm" are both legal.
      XSL-FO lengths admit no internal space, so it is stripped. A bare number
      (not schema-legal, but easy to write by hand) is taken as millimetres.
    -->
    <xsl:template name="reproduction-length">
        <xsl:param name="v"/>
        <xsl:variable name="s" select="translate(normalize-space($v), ' &#9;', '')"/>
        <xsl:choose>
            <xsl:when test="$s = ''"/>
            <xsl:when test="number($s) = number($s)">
                <xsl:value-of select="concat($s, 'mm')"/>
            </xsl:when>
            <xsl:otherwise><xsl:value-of select="$s"/></xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                          CALS TABLES                                  -->
    <!-- ==================================================================== -->
    <xsl:template match="table">
        <table>
            <xsl:copy-of select="@id"/>
            <xsl:variable name="widths">
                <xsl:for-each select="tgroup[1]/colspec">
                    <xsl:call-template name="colwidth"/>
                    <xsl:if test="position() != last()"><xsl:text> </xsl:text></xsl:if>
                </xsl:for-each>
            </xsl:variable>
            <xsl:if test="normalize-space($widths) != ''">
                <xsl:attribute name="widths"><xsl:value-of select="normalize-space($widths)"/></xsl:attribute>
            </xsl:if>
            <xsl:if test="title">
                <title><xsl:value-of select="normalize-space(title)"/></title>
            </xsl:if>
            <xsl:apply-templates select="tgroup/thead"/>
            <xsl:apply-templates select="tgroup/tbody"/>
        </table>
    </xsl:template>

    <!-- CALS colwidth: "2*" stays proportional, "30mm" stays absolute -->
    <xsl:template name="colwidth">
        <xsl:choose>
            <xsl:when test="@colwidth"><xsl:value-of select="@colwidth"/></xsl:when>
            <xsl:otherwise>1*</xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template match="thead">
        <thead><xsl:apply-templates select="row"/></thead>
    </xsl:template>

    <xsl:template match="tbody">
        <tbody><xsl:apply-templates select="row"/></tbody>
    </xsl:template>

    <xsl:template match="row">
        <row><xsl:apply-templates select="entry"/></row>
    </xsl:template>

    <xsl:template match="entry">
        <cell>
            <!-- CALS spans columns by naming the first and last column; jsstofo
                 wants a count, so it is derived from the colspec positions. -->
            <xsl:if test="@namest and @nameend">
                <xsl:variable name="cols" select="ancestor::tgroup[1]/colspec"/>
                <xsl:variable name="start" select="count($cols[@colname = current()/@namest]/preceding-sibling::colspec) + 1"/>
                <xsl:variable name="end" select="count($cols[@colname = current()/@nameend]/preceding-sibling::colspec) + 1"/>
                <xsl:if test="$end &gt;= $start">
                    <xsl:attribute name="colspan"><xsl:value-of select="$end - $start + 1"/></xsl:attribute>
                </xsl:if>
            </xsl:if>
            <xsl:if test="@morerows">
                <xsl:attribute name="rowspan"><xsl:value-of select="@morerows + 1"/></xsl:attribute>
            </xsl:if>
            <xsl:if test="@align">
                <xsl:attribute name="align"><xsl:value-of select="@align"/></xsl:attribute>
            </xsl:if>
            <xsl:apply-templates/>
        </cell>
    </xsl:template>

    <!-- Table cell paragraphs stay inline; a cell is already a block -->
    <xsl:template match="entry/para">
        <xsl:apply-templates/>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                        WARNINGS / CAUTIONS / NOTES                    -->
    <!-- ==================================================================== -->
    <xsl:template match="warning | danger">
        <warning><xsl:apply-templates/></warning>
    </xsl:template>

    <xsl:template match="caution">
        <caution><xsl:apply-templates/></caution>
    </xsl:template>

    <xsl:template match="note">
        <note><xsl:apply-templates/></note>
    </xsl:template>

    <xsl:template match="warningAndCautionPara | notePara">
        <para><xsl:apply-templates/></para>
    </xsl:template>

    <!-- Hazards referenced by IDREFS are pulled in at the point of reference -->
    <xsl:template match="@warningRefs">
        <xsl:for-each select="//warning[@id]">
            <xsl:if test="contains(concat(' ', normalize-space(current()), ' '), concat(' ', @id, ' '))">
                <warning><xsl:apply-templates/></warning>
            </xsl:if>
        </xsl:for-each>
    </xsl:template>

    <xsl:template match="@cautionRefs">
        <xsl:for-each select="//caution[@id]">
            <xsl:if test="contains(concat(' ', normalize-space(current()), ' '), concat(' ', @id, ' '))">
                <caution><xsl:apply-templates/></caution>
            </xsl:if>
        </xsl:for-each>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                           CROSS REFERENCES                            -->
    <!-- ==================================================================== -->
    <!-- S1000D references become a JSS <xref> carrier element that jsstofo
         turns into a clickable link:
           <xref to="ID">label</xref>    internal link (target @id in the book)
           <xref href="URL">label</xref> external hyperlink
           <xref>label</xref>            no resolvable target -> plain text
         The label text is preserved exactly as it read before, so a reference
         whose target is missing still shows the same readable text as always. -->

    <!-- dmRef: emit a reference to the module's section anchor (dm-<code>). The
         actual decision of link-vs-text and title-vs-code is deferred to stage 2,
         which is the only place that has the WHOLE assembled book: stage 1 loads
         data modules one at a time via document(), so it can't see which modules
         are in the publication. Stage 2 resolves the anchor; if it exists the
         reference links and shows the target section's real title, and if not it
         falls back to the raw DMC carried in @code. An author-supplied title on
         the dmRef, when present, always wins (emitted as the label here). -->
    <xsl:template match="dmRef">
        <xsl:variable name="wanted">
            <xsl:for-each select="dmRefIdent">
                <xsl:call-template name="dmcode-string"/>
            </xsl:for-each>
        </xsl:variable>
        <xref to="dm-{$wanted}" code="{$wanted}">
            <xsl:if test="dmRefAddressItems/dmTitle">
                <xsl:call-template name="dmref-label"/>
            </xsl:if>
        </xref>
    </xsl:template>

    <!-- The human-readable text for a dmRef: title if given, else the code. -->
    <xsl:template name="dmref-label">
        <xsl:choose>
            <xsl:when test="dmRefAddressItems/dmTitle">
                <xsl:value-of select="normalize-space(dmRefAddressItems/dmTitle/techName)"/>
                <xsl:if test="dmRefAddressItems/dmTitle/infoName">
                    <xsl:text> - </xsl:text>
                    <xsl:value-of select="normalize-space(dmRefAddressItems/dmTitle/infoName)"/>
                </xsl:if>
            </xsl:when>
            <xsl:otherwise>
                <xsl:for-each select="dmRefIdent">
                    <xsl:call-template name="dmcode-string"/>
                </xsl:for-each>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <!-- externalPubRef: a real hyperlink when an xlink:href is present (matched
         namespace-agnostically so we don't have to bind the xlink prefix). -->
    <xsl:template match="externalPubRef">
        <xsl:variable name="label">
            <xsl:choose>
                <xsl:when test="externalPubRefIdent/externalPubTitle">
                    <xsl:value-of select="normalize-space(externalPubRefIdent/externalPubTitle)"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="normalize-space(externalPubRefIdent/externalPubCode)"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:choose>
            <xsl:when test="@*[local-name()='href'] != ''">
                <xref href="{@*[local-name()='href']}"><xsl:value-of select="$label"/></xref>
            </xsl:when>
            <xsl:otherwise><xsl:value-of select="$label"/></xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <!-- internalRef: link to an element inside the same book by its @id. When
         the author supplied link text ("below", "see para 3") it's kept; when
         empty, the xref is left label-less so jsstofo can name the target
         itself ("Figure 3-1", "Table 2-1", the section's title). -->
    <xsl:template match="internalRef">
        <xref to="{@internalRefId}">
            <xsl:if test="normalize-space(.) != ''"><xsl:apply-templates/></xsl:if>
        </xref>
    </xsl:template>

    <!-- Applicability is carried as display text only -->
    <xsl:template match="applic">
        <xsl:if test="displayText">
            <para indent="none">
                <xsl:text>Applicable to: </xsl:text>
                <xsl:value-of select="normalize-space(displayText)"/>
            </para>
        </xsl:if>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                            SUPPRESSED                                 -->
    <!-- ==================================================================== -->
    <!-- Identification/status metadata is consumed by bookmeta, not the body -->
    <xsl:template match="identAndStatusSection"/>
    <xsl:template match="referencedApplicGroup"/>
    <xsl:template match="title"/>

    <!--
      Manual page break, authored as <?page-break?> between two block-level
      siblings (after a para, before/after a table, figure, list, note,
      caution or warning) wherever a break is wanted at one specific point —
      not tied to a heading level. A processing instruction, not an element,
      because S1000D content is schema-validated (descript.xsd/proced.xsd):
      an unknown element like a literal pageBreak here would fail validation
      in a real S1000D toolchain, but a PI is invisible to schema validation
      by design. jsstofo turns the resulting <pageBreak/> into the real break.
    -->
    <xsl:template match="processing-instruction('page-break')">
        <pageBreak/>
    </xsl:template>

    <!--
      Default: descend, so an unmapped wrapper never loses its content.

      An element with no children is a different matter. Nothing descends into
      it, so it is dropped outright along with everything its attributes carry
      — which is exactly how <symbol> went missing from every book until it was
      spotted by chance. Report those; stay quiet about wrappers, which keep
      their content and would otherwise bury the signal in noise.
    -->
    <xsl:template match="*">
        <xsl:if test="not(node())">
            <xsl:message>Unhandled element: <xsl:value-of select="name()"/></xsl:message>
        </xsl:if>
        <xsl:apply-templates/>
    </xsl:template>

    <xsl:template match="text()">
        <xsl:value-of select="."/>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                     PER-BLOCK LANDSCAPE                               -->
    <!-- ==================================================================== -->
    <!--
      orient="land" puts the marked content on a landscape page, the same
      authoring convention the direct S1000D pipeline uses. It is honoured on
      ANY element, not just <table> and <figure>:

        <table orient="land"/>, <figure orient="land"/>
            the block alone rotates; the surrounding prose stays portrait.

        <levelledPara orient="land">, <proceduralStep orient="land">
            the whole unit rotates INCLUDING ITS TITLE. Marking only a table
            inside left the heading stranded on the portrait page above it,
            which is what this branch exists to avoid: a heading belongs on
            the same page as the content it introduces.

        <title orient="land">
            shorthand for marking the levelledPara/proceduralStep the title
            belongs to, since the title is the thing an author has in front of
            them when they decide the section must be rotated.

        <para orient="land">, and anything else
            the element rotates whole.

      Nothing here emits FO. jsstofo already starts a new page-sequence
      wherever consecutive sections change orientation, and coalesces a run of
      same-orientation sections back into one sequence, so all this stage has
      to do is hand it a section boundary in the right place: the marked block
      goes into its own <section split="1" orientation="landscape">, and the
      content either side goes into ordinary split sections.

      "split" marks a section that exists only to carry an orientation. It
      takes no heading and no number, and is skipped by the contents list.

      A node that becomes a section in its own right (a titled levelledPara or
      proceduralStep) is emitted UNWRAPPED. Burying it inside a split section
      would nest it a level deeper and renumber it: 2.6.1 would become 2.6.1.1.

      Splitting one node per section looks wasteful but costs no pages, because
      jsstofo merges neighbouring sections of the same orientation into a
      single sequence. That merging is also why this does not suffer the page
      inflation the direct pipeline has, where each level of descent opens a
      sequence of its own.
    -->
    <xsl:template name="orientation-parts">
        <xsl:param name="nodes"/>
        <!-- descendant-or-self::foldout: <foldout> carries no orient attribute
             of its own - it IS the landscape signal, same as the direct
             S1000D pipeline treats it (see descript.xsl there). Without this,
             a foldout-wrapped figure/table here fell through as ordinary
             portrait content, orient="land" never being present to catch. -->
        <xsl:variable name="land"
            select="$nodes[descendant-or-self::*[@orient='land'] or descendant-or-self::foldout][1]"/>
        <xsl:choose>
            <xsl:when test="$land">
                <!-- "count(. | $land/preceding-sibling::node()) = count(...)" is
                     the XSLT 1.0 way of asking whether a node is among another
                     node's preceding siblings; there is no operator for it. -->
                <xsl:variable name="before"
                    select="$nodes[count(. | $land/preceding-sibling::node())
                                 = count($land/preceding-sibling::node())]"/>
                <xsl:variable name="after"
                    select="$nodes[count(. | $land/following-sibling::node())
                                 = count($land/following-sibling::node())]"/>

                <xsl:call-template name="portrait-parts">
                    <xsl:with-param name="nodes" select="$before"/>
                </xsl:call-template>

                <xsl:choose>
                    <!-- The node carries the mark itself, so it rotates whole:
                         no partitioning, and a title comes with it. -->
                    <xsl:when test="$land[@orient='land' or title/@orient='land' or self::foldout]">
                        <xsl:apply-templates select="$land" mode="landscape-whole"/>
                    </xsl:when>
                    <!-- A container that merely holds a marked block. Hand it
                         to its own template, which partitions its children in
                         turn, so only the marked block ends up rotated. -->
                    <xsl:when test="$land[self::description or self::mainProcedure
                                       or self::levelledPara or self::proceduralStep[title]]">
                        <xsl:apply-templates select="$land"/>
                    </xsl:when>
                    <!-- Anything else, a list or a note or a warning, cannot be
                         cut in half without losing its numbering or its frame,
                         so it rotates whole. -->
                    <xsl:otherwise>
                        <section split="1" orientation="landscape">
                            <xsl:apply-templates select="$land"/>
                        </section>
                    </xsl:otherwise>
                </xsl:choose>

                <xsl:call-template name="orientation-parts">
                    <xsl:with-param name="nodes" select="$after"/>
                </xsl:call-template>
            </xsl:when>
            <xsl:otherwise>
                <xsl:call-template name="portrait-parts">
                    <xsl:with-param name="nodes" select="$nodes"/>
                </xsl:call-template>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template name="portrait-parts">
        <xsl:param name="nodes"/>
        <xsl:for-each select="$nodes">
            <xsl:choose>
                <!-- Whitespace between two block elements. Wrapping it
                     would leave an empty section in the book. -->
                <xsl:when test="self::text() and not(normalize-space())"/>
                <!-- Becomes a section of its own: leave it alone. -->
                <xsl:when test="self::levelledPara[title] or self::proceduralStep[title]">
                    <xsl:apply-templates select="."/>
                </xsl:when>
                <!-- A continuation step is swallowed by the first step of its
                     run, which emits the whole list; wrapping it would leave an
                     empty section behind. -->
                <xsl:when test="self::proceduralStep[not(title)][preceding-sibling::proceduralStep]"/>
                <xsl:otherwise>
                    <section split="1"><xsl:apply-templates select="."/></section>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:for-each>
    </xsl:template>

    <!--
      "landscape-whole": the node itself carries orient="land", so everything
      it holds rotates together and there is nothing to partition.

      A titled unit keeps its own <section> — NOT a split one. split="1" means
      "a section that exists only to carry an orientation", and such a section
      is skipped by numbering and by the contents list; wrapping a real, titled
      section in one would either renumber it or lose it from the contents.
      A plain <section orientation="landscape"> carries the orientation just as
      well and stays a numbered, listed section, with its heading now on the
      rotated page where its content is.
    -->
    <xsl:template match="levelledPara[title] | proceduralStep[title]" mode="landscape-whole">
        <section orientation="landscape">
            <xsl:copy-of select="@id"/>
            <title><xsl:value-of select="normalize-space(title)"/></title>
            <xsl:apply-templates select="node()[not(self::title)]"/>
        </section>
    </xsl:template>

    <!--
      Untitled containers. There is no heading to keep, so a split section is
      enough — and the CHILDREN are applied, not the element itself: applying
      the element would land straight back on its own self-marked template
      below and loop forever. Safe to descend because each of these renders as
      nothing more than its children anyway (see schemas.xsl).
    -->
    <xsl:template match="levelledPara | description | mainProcedure" mode="landscape-whole">
        <section split="1" orientation="landscape">
            <xsl:apply-templates/>
        </section>
    </xsl:template>

    <!--
      A leaf block — a table, a figure, a para, a list. These have no
      self-marked template to loop back into, and several of them (a list, a
      numbered step run) render correctly only when applied as a whole, so
      apply the element itself.
    -->
    <xsl:template match="*" mode="landscape-whole">
        <section split="1" orientation="landscape">
            <xsl:apply-templates select="."/>
        </section>
    </xsl:template>

    <!--
      Containers holding a marked block partition their children instead of
      rendering them straight through. Priority is explicit so these beat the
      unconditional templates for the same elements.

      A container that is marked ITSELF (or whose title is) takes priority 4
      instead and rotates whole: the "descendant" patterns below would also
      match it — @orient on the container, and title/@orient, are both
      descendants of nothing and of the container respectively — so the
      self-marked case has to win outright.
    -->
    <xsl:template match="levelledPara[@orient='land' or title/@orient='land']"
                  priority="4">
        <xsl:apply-templates select="." mode="landscape-whole"/>
    </xsl:template>

    <xsl:template match="levelledPara[title][descendant::*[@orient='land'] or descendant::foldout]"
                  priority="3">
        <section>
            <xsl:copy-of select="@id"/>
            <title><xsl:value-of select="normalize-space(title)"/></title>
            <xsl:call-template name="orientation-parts">
                <xsl:with-param name="nodes" select="node()[not(self::title)]"/>
            </xsl:call-template>
        </section>
    </xsl:template>

    <xsl:template match="levelledPara[not(title)][descendant::*[@orient='land'] or descendant::foldout]"
                  priority="3">
        <xsl:call-template name="orientation-parts">
            <xsl:with-param name="nodes" select="node()"/>
        </xsl:call-template>
    </xsl:template>

</xsl:stylesheet>
