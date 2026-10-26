<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D to XSL-FO: Lists Module
     
     Contains templates for random, sequential, and definition lists.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format">
  <!-- ==================================================================== -->
  <!--                         RANDOM LIST                                   -->
  <!-- ==================================================================== -->
  <xsl:template match="randomList">
    <fo:block>
      <xsl:apply-templates select="title"/>
      <!-- Label column widths and item spacing come from Settings > Lists;
           they were fixed at 7mm here, so that tab did nothing on this
           engine. list.indent adds an optional step per nesting level. -->
      <fo:list-block provisional-distance-between-starts="{concat($list.gap.bullet + $list.indent * count(ancestor::randomList | ancestor::sequentialList), 'mm')}">
        <xsl:apply-templates select="listItem"/>
      </fo:list-block>
    </fo:block>
  </xsl:template>
  <xsl:template match="randomList/title">
    <fo:block font-weight="bold">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="randomList/listItem" mode="label">
    <xsl:choose>
      <xsl:when test="../@listItemPrefix = 'pf01'">&#x2022;</xsl:when>
      <!-- bullet -->
      <xsl:when test="../@listItemPrefix = 'pf02'">&#x2013;</xsl:when>
      <!-- dash -->
      <xsl:when test="../@listItemPrefix = 'pf03'">&#x25AA;</xsl:when>
      <!-- small square -->
      <xsl:when test="../@listItemPrefix = 'pf07'">&#x2014;</xsl:when>
      <!-- em dash -->
      <!-- No @listItemPrefix at all: "random" IS S1000D's word for an
           unordered list, so its unmarked default should read as one — a
           bullet, not a bare hyphen, which looks like a dash-style list
           (pf02) an author never actually chose. -->
      <xsl:otherwise>&#x2022;</xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                         SEQUENTIAL LIST                               -->
  <!-- ==================================================================== -->
  <xsl:template match="sequentialList">
    <fo:block>
      <xsl:apply-templates select="title"/>
      <fo:list-block provisional-distance-between-starts="{concat($list.gap.alpha + $list.indent * count(ancestor::randomList | ancestor::sequentialList), 'mm')}">
        <xsl:apply-templates select="listItem"/>
      </fo:list-block>
    </fo:block>
  </xsl:template>
  <xsl:template match="sequentialList/title">
    <fo:block font-weight="bold">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="sequentialList/listItem" mode="label">
    <xsl:apply-templates select="." mode="number"/>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                         LIST ITEM                                     -->
  <!-- ==================================================================== -->
  <!--
    A break BETWEEN list items cannot be an empty fo:block the way it is
    everywhere else: fo:list-block accepts only fo:list-item children, so an
    empty block there is invalid FO and FOP rejects the whole document. The
    break therefore goes onto the following item as an attribute instead.

    The marker is looked for as the nearest preceding sibling that is not
    whitespace — this stylesheet declares no strip-space, so the immediately
    preceding node is almost always an indentation text node rather than the
    marker itself.
  -->
  <xsl:template match="listItem">
    <fo:list-item space-before="{concat($list.item.space, 'mm')}">
      <xsl:variable name="prev"
                    select="preceding-sibling::node()
                            [not(self::text() and not(normalize-space()))][1]"/>
      <xsl:if test="$prev[self::processing-instruction('page-break')]
                    or $prev[self::pageBreak]">
        <xsl:attribute name="break-before">page</xsl:attribute>
      </xsl:if>
      <fo:list-item-label end-indent="label-end()">
        <fo:block>
          <xsl:apply-templates select="." mode="label"/>
        </fo:block>
      </fo:list-item-label>
      <fo:list-item-body start-indent="body-start()">
        <fo:block>
          <xsl:apply-templates select="para|processing-instruction('page-break')"/>
        </fo:block>
      </fo:list-item-body>
    </fo:list-item>
  </xsl:template>
  <xsl:template match="listItem" mode="number">
    <xsl:choose>
      <!-- JSS format: use alphanumeric excluding i, o, x, v for nested levels -->
      <xsl:when test="contains($document.format, 'JSS')">
        <xsl:call-template name="jss.list.number"/>
      </xsl:when>
      <!-- S1000D format: standard numeric -->
      <xsl:otherwise>
        <xsl:number count="listItem" level="multiple"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <!-- JSS-specific list numbering template (using substring extraction like demojss.xsl) -->
  <xsl:template name="jss.list.number">
    <xsl:variable name="depth" select="count(ancestor::*[self::sequentialList or self::randomList])"/>
    <xsl:variable name="pos" select="count(preceding-sibling::listItem) + 1"/>
    <xsl:choose>
      <!-- Level 1: lowercase alpha with parentheses (a), (b), (c)... excluding i,o,v using substring -->
      <xsl:when test="$depth = 1">
        <xsl:text>(</xsl:text>
        <xsl:value-of select="substring($jss.alpha.lower, $pos, 1)"/>
        <xsl:text>)</xsl:text>
      </xsl:when>
      <!-- Level 2+: lowercase roman numerals with parentheses (i), (ii), (iii)... -->
      <xsl:otherwise>
        <xsl:text>(</xsl:text>
        <xsl:number count="listItem" format="i"/>
        <xsl:text>)</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <xsl:template match="listItem/para">
    <fo:block space-before.optimum="10pt" 
        space-before.minimum="8pt" 
        space-before.maximum="12pt">
      <xsl:if test="@id">
        <xsl:call-template name="copy.id"/>
      </xsl:if>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                         DEFINITION LIST                               -->
  <!-- ==================================================================== -->
  <xsl:template match="definitionList">
    <fo:list-block id="{generate-id()}" 
        provisional-distance-between-starts="{$definition.list.term.width}" 
        provisional-label-separation="1em" 
        space-before.optimum="1em" 
        space-before.minimum="0.8em" 
        space-before.maximum="1.2em" 
        space-after.optimum="1em" 
        space-after.minimum="0.8em" 
        space-after.maximum="1.2em">
      <xsl:apply-templates select="definitionListItem"/>
    </fo:list-block>
  </xsl:template>
  <xsl:template match="definitionListItem">
    <fo:list-item id="{generate-id()}" 
        space-before.optimum="0.5em" 
        space-before.minimum="0.4em" 
        space-before.maximum="0.6em">
      <xsl:apply-templates select="listItemTerm"/>
      <xsl:apply-templates select="listItemDefinition"/>
    </fo:list-item>
  </xsl:template>
  <xsl:template match="listItemTerm">
    <fo:list-item-label end-indent="label-end()" text-align="start">
      <fo:block>
        <xsl:apply-templates/>
      </fo:block>
    </fo:list-item-label>
  </xsl:template>
  <xsl:template match="listItemDefinition">
    <fo:list-item-body start-indent="body-start()">
      <fo:block>
        <xsl:apply-templates/>
      </fo:block>
    </fo:list-item-body>
  </xsl:template>
  <!-- Nested lists inside definition -->
  <xsl:template match="randomList[ancestor::listItemDefinition]">
    <fo:list-block provisional-label-separation="0.2em" 
        provisional-distance-between-starts="7mm">
      <xsl:apply-templates select="listItem"/>
    </fo:list-block>
  </xsl:template>
  <!-- Para inside definition list -->
  <xsl:template match="definitionListItem//para">
    <fo:block space-before.optimum="10pt" 
        space-before.minimum="8pt" 
        space-before.maximum="12pt">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    ATTENTION LIST (warnings/cautions)                 -->
  <!-- ==================================================================== -->
  <!--
    A SECOND template for this pair lived in warnings.xsl, at the same
    priority and included after this one — an outright conflict that
    xsltproc resolved silently by taking whichever stylesheet came last,
    which was that one.

    That did not matter for the actual defect, because BOTH copies made the
    same mistake: <fo:block><xsl:apply-templates/></fo:block>, with no
    fo:list-block around the fo:list-item children the item template below
    goes on to emit. fo:list-item is not valid content for anything but
    fo:list-block, so a note or warning carrying one of these lists made FOP
    reject the whole document — "fo:list-item is not a valid child of
    fo:block" — and the entire build failed with no PDF at all, for a
    perfectly well-formed data module.

    randomList and sequentialList, two templates above, wrap their items in
    fo:list-block correctly; this is that same shape, for the attention-list
    variant S1000D uses specifically inside a warning/caution/note.
  -->
  <xsl:template match="attentionRandomList|attentionSequentialList">
    <xsl:variable name="gap">
      <xsl:choose>
        <xsl:when test="self::attentionSequentialList"><xsl:value-of select="$list.gap.alpha"/></xsl:when>
        <xsl:otherwise><xsl:value-of select="$list.gap.bullet"/></xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <fo:block>
      <fo:list-block provisional-distance-between-starts="{concat(
          number($gap) + $list.indent * count(ancestor::randomList | ancestor::sequentialList
              | ancestor::attentionRandomList | ancestor::attentionSequentialList),
          'mm')}">
        <xsl:apply-templates select="attentionRandomListItem|attentionSequentialListItem"/>
      </fo:list-block>
    </fo:block>
  </xsl:template>
  <xsl:template match="attentionRandomListItem|attentionSequentialListItem">
    <fo:list-item space-before="{concat($list.item.space, 'mm')}">
      <fo:list-item-label end-indent="label-end()">
        <fo:block>
          <xsl:apply-templates select="." mode="label"/>
        </fo:block>
      </fo:list-item-label>
      <fo:list-item-body start-indent="body-start()">
        <fo:block>
          <xsl:apply-templates select="attentionListItemPara|warningAndCautionPara"/>
        </fo:block>
      </fo:list-item-body>
    </fo:list-item>
  </xsl:template>
  <xsl:template match="attentionRandomListItem" mode="label">
    <xsl:text>&#x2022;</xsl:text>
  </xsl:template>
  <xsl:template match="attentionSequentialListItem" mode="label">
    <xsl:number count="attentionSequentialListItem"/>
  </xsl:template>
  <xsl:template match="attentionListItemPara">
    <fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
</xsl:stylesheet>