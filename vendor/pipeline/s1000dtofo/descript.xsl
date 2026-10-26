<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D to XSL-FO: Descriptive Data Module
     
     Contains templates for processing descriptive data modules
     (descript.xsd based modules).
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <!-- ==================================================================== -->
  <!--                    DESCRIPTIVE DMODULE TEMPLATE                       -->
  <!-- ==================================================================== -->
  <xsl:template match="dmodule[contains(@xsi:noNamespaceSchemaLocation, 'descript.xsd')]">
    <xsl:choose>
      <xsl:when test="content/description/*[descendant-or-self::*[@orient='land'] or descendant-or-self::foldout]">
        <xsl:call-template name="emit-descript-landscape"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="page-sequence">
          <xsl:with-param name="content">
            <fo:block>
              <!-- Generate markers for headers/footers -->
              <xsl:call-template name="generate-markers"/>
              <!-- Process the content -->
              <fo:block id="content-start-{generate-id()}" padding-bottom="20mm">
                <xsl:apply-templates select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle"/>
                <xsl:apply-templates select="content"/>
              </fo:block>
              <!-- End of data module marker -->
              <fo:block>
                <xsl:call-template name="end-of-datamodule-marker"/>
              </fo:block>
            </fo:block>
          </xsl:with-param>
        </xsl:call-template>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <!-- Fallback for generic dmodule without schema detection -->
  <xsl:template match="dmodule">
    <xsl:choose>
      <xsl:when test="content/description/*[descendant-or-self::*[@orient='land'] or descendant-or-self::foldout]">
        <xsl:call-template name="emit-descript-landscape"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="page-sequence">
          <xsl:with-param name="content">
            <fo:block>
              <!-- Generate markers for headers/footers -->
              <xsl:call-template name="generate-markers"/>
              <!-- Process the content -->
              <fo:block id="content-start-{generate-id()}" padding-bottom="20mm">
                <xsl:apply-templates select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle"/>
                <xsl:apply-templates select="content"/>
              </fo:block>
              <!-- End of data module marker -->
              <fo:block>
                <xsl:call-template name="end-of-datamodule-marker"/>
              </fo:block>
            </fo:block>
          </xsl:with-param>
        </xsl:call-template>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <!--
    A data module that is portrait apart from one wide table or illustration.

    XSL-FO fixes page geometry for a whole fo:page-sequence, so a landscape page
    in the middle of a portrait module is not something you can set on the table
    itself: the module has to be emitted as several sequences, swapping the page
    master for the landscape stretch. Page numbering runs on unbroken because
    every sequence uses initial-page-number="auto", and each one re-emits
    generate-markers because fo:retrieve-marker in the running head is bounded
    by the page-sequence and would otherwise come up empty after the first.

    Marked up with the CALS attribute the table model already carries. It is
    honoured on ANY element, not just tables and figures:

        <table orient="land">          the block alone turns
        <figure orient="land">         the block alone turns
        <levelledPara orient="land">   the whole unit turns, TITLE INCLUDED
        <proceduralStep orient="land"> likewise
        <title orient="land">          shorthand for marking the levelledPara
                                       or proceduralStep the title heads
        <para orient="land">           that paragraph turns
        <foldout><figure>...</foldout> the wrapped figure or table turns,
                                       exactly like orient="land" on it would

    A marked CONTAINER turns whole; an unmarked container that merely holds a
    marked block is descended into, so only the marked block turns and the
    prose either side of it stays portrait. <foldout> is a real S1000D
    element (wraps a figure/figureAlts or a table meant to print as an
    oversized fold-out page), not an attribute, but it is folded into this
    same detection and rotation logic rather than given a parallel mechanism
    - see the "descendant-or-self::foldout" checks below.

    A module with no such attribute never reaches this code at all.
  -->
  <xsl:template name="emit-descript-landscape">
    <xsl:call-template name="emit-orientation-runs">
      <xsl:with-param name="desc" select="content/description"/>
      <xsl:with-param name="nodes" select="content/description/*"/>
      <xsl:with-param name="tail"
        select="content/procedure|content/faultIsolation|content/faultReporting|content/illustratedPartsCatalog|content/crew"/>
      <xsl:with-param name="first" select="1"/>
    </xsl:call-template>
  </xsl:template>

  <!--
    Walks the module's top-level blocks and emits one page-sequence per run of
    same-orientation content, recursing on what is left.

    Written as a recursion rather than "everything before the first landscape
    block, everything after the last" because that earlier shape silently DROPPED
    portrait content sitting BETWEEN two landscape blocks: it was in neither the
    before-set nor the after-set, and nothing ever rendered it.

    "count(. | $land/preceding-sibling::*) = count($land/preceding-sibling::*)"
    is the XSLT 1.0 way to ask whether a node is among another node's preceding
    siblings — there is no node-comparison operator that says it directly.
  -->
  <xsl:template name="emit-orientation-runs">
    <xsl:param name="nodes"/>
    <xsl:param name="desc"/>
    <xsl:param name="tail"/>
    <xsl:param name="first" select="0"/>
    <!-- 1 while partitioning the children of a section rather than the
         module's own top-level blocks. A nested run never closes the module,
         so it emits no end-of-module marker and never pads to an even page. -->
    <xsl:param name="nested" select="0"/>
    <!--
      Content that belongs at the head of the next run: a descended section's
      own title. It rides along rather than getting a page-sequence of its own,
      which would have printed the heading alone on an otherwise blank page.
    -->
    <xsl:param name="lead" select="/.."/>
    <!--
      1 when this invocation is the one that ends the data module, so whatever
      it emits last carries the end-of-module marker and the end-on-even
      padding. It is handed DOWN into a descend, because when the marked table
      sits inside the module's final section it is the nested run, not this
      one, that finishes the module.
    -->
    <xsl:param name="closes" select="1"/>
    <!--
      <foldout> (wraps a figure or table meant to print as an oversized
      fold-out page) is treated exactly like orient="land": it is the same
      "this block needs the wide page master" signal, just spelled as an
      element instead of an attribute. See the foldout template below for
      what actually renders inside the rotated page.
    -->
    <xsl:variable name="land" select="$nodes[descendant-or-self::*[@orient='land'] or descendant-or-self::foldout][1]"/>
    <xsl:choose>
      <xsl:when test="$land">
        <xsl:variable name="before"
          select="$nodes[count(. | $land/preceding-sibling::*) = count($land/preceding-sibling::*)]"/>
        <xsl:variable name="after"
          select="$nodes[count(. | $land/following-sibling::*) = count($land/following-sibling::*)]"/>
        <!--
          Nothing follows the marked block, here or in any caller: this branch
          ends the module, so the end-of-module marker and the padding go on
          the sequence it emits.

          This used to additionally require the marked node to BE the table or
          figure, and to be at the module's top level ($nested = 0). Both
          exclusions cost a page. A table marked inside the module's last
          titled section satisfies neither, so the module was closed by a
          further recursion whose content was empty — one blank page with a
          running head and no legend — and the end-on-even padding then landed
          on TOP of it, adding a second. That is the two stray pages after a
          landscape table.
        -->
        <xsl:variable name="closes-here" select="$closes = 1 and not($after) and not($tail)"/>

        <!--
          Portrait run for whatever precedes the landscape block. Emitted on
          the first pass even when empty, because that is where the module
          title and its front matter belong.

          last=1 (end-on-even), not the 0 every other portrait run in a
          module gets: a landscape run is a physically distinct print unit —
          bound rotated, read by turning the page — so the run immediately
          before it must always end on an even page, or the landscape run
          itself opens on the back of this one instead of its own right-hand
          page. Symmetric with the landscape run's own last=1 below, which
          covers the same requirement at its OTHER edge.
        -->
        <xsl:if test="$before or $first = 1 or ($lead and $before)">
          <xsl:call-template name="page-sequence">
            <xsl:with-param name="last" select="1"/>
            <xsl:with-param name="content">
              <fo:block>
                <xsl:call-template name="generate-markers"/>
                <fo:block padding-bottom="20mm">
                  <xsl:if test="$first = 1">
                    <xsl:attribute name="id">content-start-<xsl:value-of select="generate-id()"/></xsl:attribute>
                    <xsl:apply-templates select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle"/>
                    <xsl:call-template name="emit-front-matter"/>
                  </xsl:if>
                  <xsl:if test="$before and $lead">
                    <xsl:apply-templates select="$lead"/>
                  </xsl:if>
                  <xsl:if test="$before">
                    <xsl:choose>
                      <xsl:when test="$nested = 1">
                        <xsl:apply-templates select="$before"/>
                      </xsl:when>
                      <xsl:when test="$desc">
                        <xsl:call-template name="render-description">
                          <xsl:with-param name="desc-node" select="$desc"/>
                          <xsl:with-param name="nodes" select="$before"/>
                          <xsl:with-param name="include-heading" select="$first"/>
                        </xsl:call-template>
                      </xsl:when>
                      <!-- No <description> wrapper: a procedure module, whose
                           blocks render directly. -->
                      <xsl:otherwise>
                        <xsl:apply-templates select="$before"/>
                      </xsl:otherwise>
                    </xsl:choose>
                  </xsl:if>
                </fo:block>
              </fo:block>
            </xsl:with-param>
          </xsl:call-template>
        </xsl:if>

        <xsl:choose>
          <!--
            The node carries the mark itself, so it rotates WHOLE and nothing
            else travels with it.

            For a table or figure that is the block alone. For a levelledPara
            or proceduralStep it is the whole unit, heading included — marking
            only the table inside one left its heading stranded on the portrait
            page above, which is the reason the mark is honoured up here rather
            than on tables and figures alone. orient="land" on the <title> says
            the same thing about the section the title heads, since the title
            is what an author has in front of them when they decide it has to
            turn.
          -->
          <xsl:when test="$land[@orient='land' or title/@orient='land' or self::foldout]">
            <xsl:call-template name="page-sequence-landscape">
              <!--
                Always 1, not just when $closes-here: a landscape run is a
                physically distinct print unit, so its own "back" page must
                be the intentionally-blank legend whenever it would otherwise
                fall to whatever comes next — not only when nothing does.
                $closes-here still separately controls the end-of-module
                marker below, unchanged.
              -->
              <xsl:with-param name="last" select="1"/>
              <xsl:with-param name="content">
                <fo:block>
                  <xsl:call-template name="generate-markers"/>
                  <fo:block padding-bottom="20mm">
                    <xsl:if test="not($before)">
                      <xsl:apply-templates select="$lead"/>
                    </xsl:if>
                    <xsl:apply-templates select="$land"/>
                  </fo:block>
                  <xsl:if test="$closes-here">
                    <fo:block>
                      <xsl:call-template name="end-of-datamodule-marker"/>
                    </fo:block>
                  </xsl:if>
                </fo:block>
              </xsl:with-param>
            </xsl:call-template>
          </xsl:when>

          <!--
            A section that CONTAINS the marked table. Descend into it so only
            the table is rotated and the section's own prose stays portrait.

            Only a section with a title is descended into. A titled levelledPara
            renders as a plain wrapper block, so emitting its title in the
            portrait run and then partitioning its children reproduces it
            exactly. An untitled one is a numbered fo:list-block whose label and
            body cannot be split across page-sequences without losing the
            numbering, so it is rotated whole.
          -->
          <!--
            A numbered section with no title renders as an fo:list-block whose
            label and body cannot be split across page-sequences without losing
            the numbering, so it is rotated whole.
          -->
          <xsl:when test="$land[self::levelledPara or self::proceduralStep][not(title)]">
            <xsl:call-template name="page-sequence-landscape">
              <!--
                Always 1, not just when $closes-here: a landscape run is a
                physically distinct print unit, so its own "back" page must
                be the intentionally-blank legend whenever it would otherwise
                fall to whatever comes next — not only when nothing does.
                $closes-here still separately controls the end-of-module
                marker below, unchanged.
              -->
              <xsl:with-param name="last" select="1"/>
              <xsl:with-param name="content">
                <fo:block>
                  <xsl:call-template name="generate-markers"/>
                  <fo:block padding-bottom="20mm">
                    <xsl:if test="not($before)">
                      <xsl:apply-templates select="$lead"/>
                    </xsl:if>
                    <xsl:apply-templates select="$land"/>
                  </fo:block>
                  <xsl:if test="$closes-here">
                    <fo:block>
                      <xsl:call-template name="end-of-datamodule-marker"/>
                    </fo:block>
                  </xsl:if>
                </fo:block>
              </xsl:with-param>
            </xsl:call-template>
          </xsl:when>

          <!--
            Anything else is a wrapper block: a titled section, or a structural
            container such as mainProcedure that renders as a plain block.
            Descend so only the marked table is rotated, carrying the wrapper's
            title (if it has one) into the neighbouring run.
          -->
          <xsl:otherwise>
            <xsl:call-template name="emit-orientation-runs">
              <xsl:with-param name="nodes" select="$land/*[not(self::title)]"/>
              <xsl:with-param name="desc" select="$desc"/>
              <xsl:with-param name="tail" select="/.."/>
              <xsl:with-param name="first" select="0"/>
              <xsl:with-param name="nested" select="1"/>
              <xsl:with-param name="lead" select="$land/title"/>
              <!-- The section closes the module only if nothing follows it. -->
              <xsl:with-param name="closes" select="$closes-here"/>
            </xsl:call-template>
          </xsl:otherwise>

        </xsl:choose>

        <!--
          Only when this branch has NOT already closed the module. Recursing
          regardless is what opened the empty closing sequence: with $after and
          $tail both empty there was nothing left to render, and the run still
          cost a page.
        -->
        <xsl:if test="not($closes-here)">
          <xsl:call-template name="emit-orientation-runs">
            <xsl:with-param name="nodes" select="$after"/>
            <xsl:with-param name="desc" select="$desc"/>
            <xsl:with-param name="tail" select="$tail"/>
            <xsl:with-param name="first" select="0"/>
            <xsl:with-param name="nested" select="$nested"/>
            <xsl:with-param name="closes" select="$closes"/>
          </xsl:call-template>
        </xsl:if>
      </xsl:when>

      <!-- Nothing landscape left. -->
      <xsl:otherwise>
        <xsl:choose>
          <!--
            Inside a section: just the remaining portrait content. It closes
            the module when the section it belongs to was the last thing in
            it — $closes says so — in which case it takes the end-of-module
            marker and the padding, and no further sequence is opened.
          -->
          <xsl:when test="$nested = 1">
            <xsl:if test="$nodes or $lead">
              <xsl:call-template name="page-sequence">
                <xsl:with-param name="last" select="$closes"/>
                <xsl:with-param name="content">
                  <fo:block>
                    <xsl:call-template name="generate-markers"/>
                    <fo:block padding-bottom="20mm">
                      <xsl:apply-templates select="$lead"/>
                      <xsl:apply-templates select="$nodes"/>
                    </fo:block>
                    <xsl:if test="$closes = 1">
                      <fo:block>
                        <xsl:call-template name="end-of-datamodule-marker"/>
                      </fo:block>
                    </xsl:if>
                  </fo:block>
                </xsl:with-param>
              </xsl:call-template>
            </xsl:if>
          </xsl:when>
          <!-- The module's closing run: the only one that pads to an even page. -->
          <xsl:otherwise>
            <xsl:call-template name="page-sequence">
              <xsl:with-param name="last" select="1"/>
              <xsl:with-param name="content">
                <fo:block>
                  <xsl:call-template name="generate-markers"/>
                  <fo:block padding-bottom="20mm">
                    <xsl:if test="$first = 1">
                      <xsl:attribute name="id">content-start-<xsl:value-of select="generate-id()"/></xsl:attribute>
                      <xsl:apply-templates select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle"/>
                      <xsl:call-template name="emit-front-matter"/>
                    </xsl:if>
                    <xsl:if test="$nodes">
                      <xsl:choose>
                        <xsl:when test="$desc">
                          <xsl:call-template name="render-description">
                            <xsl:with-param name="desc-node" select="$desc"/>
                            <xsl:with-param name="nodes" select="$nodes"/>
                            <xsl:with-param name="include-heading" select="$first"/>
                          </xsl:call-template>
                        </xsl:when>
                        <xsl:otherwise>
                          <xsl:apply-templates select="$nodes"/>
                        </xsl:otherwise>
                      </xsl:choose>
                    </xsl:if>
                    <xsl:apply-templates select="$tail"/>
                  </fo:block>
                  <fo:block>
                    <xsl:call-template name="end-of-datamodule-marker"/>
                  </fo:block>
                </fo:block>
              </xsl:with-param>
            </xsl:call-template>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    CONTENT TEMPLATE                                   -->
  <!-- ==================================================================== -->
  <xsl:template match="content">
    <!-- Generate per-DM front matter: TOC, List of Tables, List of Figures -->
    <xsl:variable name="current-dm" select="ancestor::dmodule"/>
    <xsl:call-template name="table-of-contents">
      <xsl:with-param name="scope" select="$current-dm"/>
    </xsl:call-template>
    <xsl:call-template name="list-of-tables">
      <xsl:with-param name="scope" select="$current-dm"/>
    </xsl:call-template>
    <xsl:call-template name="list-of-figures">
      <xsl:with-param name="scope" select="$current-dm"/>
    </xsl:call-template>
    <!-- References table only for S1000D format, not JSS -->
    <xsl:if test="not(contains($document.format, 'JSS'))">
      <xsl:call-template name="references"/>
    </xsl:if>
    <!-- Process main content - handle all content types -->
    <xsl:apply-templates select="description|procedure|faultIsolation|faultReporting|illustratedPartsCatalog|crew"/>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    DESCRIPTION TEMPLATE                               -->
  <!-- ==================================================================== -->
  <xsl:template match="description">
    <fo:block id="{generate-id()}">
      <xsl:if test="$show.schema.heading != 0">
        <xsl:choose>
          <!-- JSS format: custom chapter formatting -->
          <xsl:when test="contains($document.format, 'JSS')">
            <fo:block border-top="1pt solid black" border-bottom="1pt solid black" 
                                  padding-top="6pt" padding-bottom="6pt" text-align="left">
              <!-- Display techName -->
              <fo:block font-weight="bold" font-size="{$heading1-size}" margin-bottom="6pt">
                <xsl:value-of select="../../identAndStatusSection/dmAddress/dmAddressItems/dmTitle/techName"/>
              </fo:block>
              <!-- Display infoName if it exists -->
              <xsl:if test="../../identAndStatusSection/dmAddress/dmAddressItems/dmTitle/infoName">
                <fo:block font-weight="bold" font-size="{$heading1-size}">
                  <xsl:value-of select="../../identAndStatusSection/dmAddress/dmAddressItems/dmTitle/infoName"/>
                </fo:block>
              </xsl:if>
            </fo:block>
          </xsl:when>
          <!-- S1000D format: use default centerhead2 -->
          <xsl:otherwise>
            <fo:block xsl:use-attribute-sets="centerhead2">Description</fo:block>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:if>
      <xsl:apply-templates select="@warningRefs"/>
      <xsl:apply-templates select="@cautionRefs"/>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template name="render-description">
    <xsl:param name="desc-node"/>
    <xsl:param name="nodes"/>
    <xsl:param name="include-heading" select="1"/>
    <fo:block>
      <xsl:if test="$include-heading and $show.schema.heading != 0">
        <xsl:choose>
          <!-- JSS format: custom chapter formatting -->
          <xsl:when test="contains($document.format, 'JSS')">
            <fo:block border-top="1pt solid black" border-bottom="1pt solid black" 
                                  padding-top="6pt" padding-bottom="6pt" text-align="left">
              <!-- Display techName -->
              <fo:block font-weight="bold" font-size="{$heading1-size}" margin-bottom="6pt">
                <xsl:value-of select="//identAndStatusSection/dmAddress/dmAddressItems/dmTitle/techName"/>
              </fo:block>
              <!-- Display infoName if it exists -->
              <xsl:if test="//identAndStatusSection/dmAddress/dmAddressItems/dmTitle/infoName">
                <fo:block font-weight="bold" font-size="{$heading1-size}">
                  <xsl:value-of select="//identAndStatusSection/dmAddress/dmAddressItems/dmTitle/infoName"/>
                </fo:block>
              </xsl:if>
            </fo:block>
          </xsl:when>
          <!-- S1000D format: use default centerhead2 -->
          <xsl:otherwise>
            <fo:block xsl:use-attribute-sets="centerhead2">Description</fo:block>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:if>
      <xsl:if test="$include-heading">
        <xsl:apply-templates select="$desc-node/@warningRefs"/>
        <xsl:apply-templates select="$desc-node/@cautionRefs"/>
      </xsl:if>
      <xsl:apply-templates select="$nodes"/>
    </fo:block>
  </xsl:template>
  <xsl:template name="emit-front-matter">
    <xsl:variable name="current-dm" select="ancestor-or-self::dmodule"/>
    <xsl:call-template name="table-of-contents">
      <xsl:with-param name="scope" select="$current-dm"/>
    </xsl:call-template>
    <xsl:call-template name="list-of-tables">
      <xsl:with-param name="scope" select="$current-dm"/>
    </xsl:call-template>
    <xsl:call-template name="list-of-figures">
      <xsl:with-param name="scope" select="$current-dm"/>
    </xsl:call-template>
    <!--
      With <content> as the context node, exactly as the ordinary (all-portrait)
      path reaches it from the content template. The references template asks
      for ".//dmRef", so calling it with the dmodule as context instead swept in
      the BREX dmRef from identAndStatusSection and listed that as a reference
      rather than printing "None".
    -->
    <xsl:if test="not(contains($document.format, 'JSS'))">
      <xsl:for-each select="ancestor-or-self::dmodule/content">
        <xsl:call-template name="references"/>
      </xsl:for-each>
    </xsl:if>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    LEVELLED PARAGRAPH TEMPLATES                       -->
  <!-- ==================================================================== -->
  <xsl:template match="levelledPara[title]">
    <fo:block id="{generate-id()}">
      <!-- select="*" would drop an authored <?page-break?>: a processing
         instruction is not an element, so the break silently did nothing
         exactly where authors most often want one (between a figure and
         the table that follows it). -->
    <xsl:apply-templates select="*|processing-instruction('page-break')"/>
    </fo:block>
  </xsl:template>
  <xsl:template match="levelledPara[not(title)]">
    <fo:block padding-top="{$standard-leading}">
      <fo:list-block provisional-distance-between-starts="{$inner-type-limit}">
        <fo:list-item>
          <fo:list-item-label end-indent="label-end()">
            <fo:block>
              <xsl:apply-templates select="." mode="number"/>
            </fo:block>
          </fo:list-item-label>
          <fo:list-item-body start-indent="body-start()">
            <fo:block>
              <xsl:apply-templates select="*[1]"/>
            </fo:block>
          </fo:list-item-body>
        </fo:list-item>
      </fo:list-block>
      <xsl:apply-templates select="*[position() != 1] | processing-instruction('page-break')[preceding-sibling::*]"/>
    </fo:block>
  </xsl:template>
  <xsl:template match="levelledPara" mode="number">
    <xsl:choose>
      <!-- JSS format: counts from description/procedure parent with 1.1.1 format -->
      <xsl:when test="contains($document.format, 'JSS')">
        <xsl:number level="multiple" count="description | procedure | levelledPara" from="content" format="1.1.1"/>
      </xsl:when>
      <!-- S1000D format: standard numbering -->
      <xsl:otherwise>
        <xsl:number count="levelledPara" level="multiple" from="dmodule"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <xsl:template match="levelledPara" mode="label">
    <xsl:text>Para </xsl:text>
    <xsl:apply-templates select="." mode="number"/>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    LEVELLED PARAGRAPH TITLE                           -->
  <!-- ==================================================================== -->
  <xsl:template match="levelledPara/title">
    <xsl:variable name="level" select="count(ancestor::levelledPara)"/>
    <!-- Calculate indentation for nested levels (JSS format only) -->
    <!-- Each level indents by 20mm: level 1 = 0mm, level 2 = 20mm, level 3 = 40mm, etc. -->
    <xsl:variable name="indent">
      <xsl:choose>
        <xsl:when test="contains($document.format, 'JSS')">
          <xsl:value-of select="concat(($level - 1) * 7, 'mm')"/>
        </xsl:when>
        <xsl:otherwise>0mm</xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <!-- Column width for the number matches the body text indent ($inner-type-limit)
         so the title text aligns with body paragraph text below it. -->
    <xsl:variable name="number-column-width">
      <xsl:choose>
        <xsl:when test="contains($document.format, 'JSS')">
          <xsl:choose>
            <xsl:when test="$level = 1">12mm</xsl:when>
            <xsl:when test="$level = 2">14mm</xsl:when>
            <xsl:otherwise>16mm</xsl:otherwise>
          </xsl:choose>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$inner-type-limit"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <!-- Per-level heading size and case, from Settings. The size used to be a
         fixed 14pt here, on a block INSIDE the one carrying the sidehead
         attribute-set — so it overrode the attribute-set and no heading size
         setting could ever take effect on this engine. -->
    <xsl:variable name="heading-size">
      <xsl:choose>
        <xsl:when test="$level = 1"><xsl:value-of select="$heading.1.size"/></xsl:when>
        <xsl:when test="$level = 2"><xsl:value-of select="$heading.2.size"/></xsl:when>
        <xsl:when test="$level = 3"><xsl:value-of select="$heading.3.size"/></xsl:when>
        <xsl:otherwise><xsl:value-of select="$heading.4.size"/></xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="heading-upper">
      <xsl:choose>
        <xsl:when test="$level = 1"><xsl:value-of select="$heading.1.uppercase"/></xsl:when>
        <xsl:when test="$level = 2"><xsl:value-of select="$heading.2.uppercase"/></xsl:when>
        <xsl:when test="$level = 3"><xsl:value-of select="$heading.3.uppercase"/></xsl:when>
        <xsl:otherwise><xsl:value-of select="$heading.4.uppercase"/></xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="content">
      <fo:block font-size="{$heading-size}" font-weight="bold" 
          provisional-distance-between-starts="{$inner-type-limit}">
        <fo:block font-family="{$font-stack}" start-indent="{$indent}" keep-with-next.within-page="always">
          <fo:table table-layout="fixed" width="100%">
            <fo:table-column column-width="{$number-column-width}"/>
            <fo:table-column column-width="proportional-column-width(1)"/>
            <fo:table-body>
              <fo:table-row>
                <fo:table-cell padding-end="3mm">
                  <fo:block>
                    <xsl:apply-templates select="parent::*" mode="number"/>
                  </fo:block>
                </fo:table-cell>
                <fo:table-cell>
                  <fo:block>
                    <xsl:choose>
                      <!-- Uppercasing flattens the title to text; headings are
                           plain wording, and folding case around inline markup
                           is not something the setting can express anyway. -->
                      <xsl:when test="$heading-upper = '1'">
                        <xsl:variable name="raw"><xsl:apply-templates/></xsl:variable>
                        <xsl:value-of select="translate($raw, $lower, $upper)"/>
                      </xsl:when>
                      <xsl:otherwise><xsl:apply-templates/></xsl:otherwise>
                    </xsl:choose>
                  </fo:block>
                </fo:table-cell>
              </fo:table-row>
            </fo:table-body>
          </fo:table>
        </fo:block>
      </fo:block>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="$level = 1">
        <fo:block xsl:use-attribute-sets="sidehead1">
          <xsl:copy-of select="$content"/>
        </fo:block>
      </xsl:when>
      <xsl:when test="$level = 2">
        <fo:block xsl:use-attribute-sets="sidehead2">
          <xsl:copy-of select="$content"/>
        </fo:block>
      </xsl:when>
      <xsl:when test="$level = 3">
        <fo:block xsl:use-attribute-sets="sidehead3">
          <xsl:copy-of select="$content"/>
        </fo:block>
      </xsl:when>
      <xsl:when test="$level = 4">
        <fo:block xsl:use-attribute-sets="sidehead4">
          <xsl:copy-of select="$content"/>
        </fo:block>
      </xsl:when>
      <xsl:otherwise>
        <fo:block xsl:use-attribute-sets="sidehead5">
          <xsl:copy-of select="$content"/>
        </fo:block>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    COMMON INFO                                        -->
  <!-- ==================================================================== -->
  <xsl:template match="commonInfo">
    <fo:block id="{generate-id()}">
      <xsl:choose>
        <xsl:when test="title">
          <fo:block xsl:use-attribute-sets="centerhead2">
            <xsl:value-of select="title"/>
          </fo:block>
        </xsl:when>
        <xsl:otherwise>
          <fo:block xsl:use-attribute-sets="centerhead2">Common information</fo:block>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="figure|foldout|note|para|commonInfoDescrPara|processing-instruction('page-break')"/>
    </fo:block>
  </xsl:template>
  <!--
    figure / graphic / figure-caption rendering lives in figures.xsl.

    This module used to carry its own duplicate `figure` and `graphic`
    templates (the latter at priority="1"). Because descript.xsl is included
    AFTER figures.xsl they silently won every match, which had three effects:
    a figure was force-kept on one page (so a multi-image figure or a long
    callout key overran the page bottom), every image was poured into a fixed
    150x160mm box regardless of its real proportions, and the callout legend
    was never rendered at all. Removed so the module actually named for the
    job owns it, and there is one definition rather than two competing ones.
  -->
  <xsl:template match="commonInfoDescrPara">
    <fo:block padding-top="{$standard-leading}">
      <fo:list-block provisional-distance-between-starts="{$inner-type-limit}">
        <fo:list-item>
          <fo:list-item-label end-indent="label-end()">
            <fo:block>
              <xsl:apply-templates select="." mode="number"/>
            </fo:block>
          </fo:list-item-label>
          <fo:list-item-body start-indent="body-start()">
            <fo:block>
              <xsl:apply-templates select="*[1]"/>
            </fo:block>
          </fo:list-item-body>
        </fo:list-item>
      </fo:list-block>
      <xsl:apply-templates select="*[position() != 1]"/>
    </fo:block>
  </xsl:template>
  <xsl:template match="commonInfoDescrPara" mode="number">
    <xsl:if test="parent::commonInfoDescrPara">
      <xsl:apply-templates select="parent::commonInfoDescrPara" mode="number"/>
      <xsl:text>.</xsl:text>
    </xsl:if>
    <xsl:number level="single" count="commonInfoDescrPara"/>
  </xsl:template>
</xsl:stylesheet>